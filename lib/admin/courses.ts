import { Types } from "mongoose";
import type { z } from "zod";
import { Asset, Course, CourseAssignment, ExportJob, GenerationCheckpoint, GenerationJob, User } from "@/models";
import { requireActiveUser, requireAdmin } from "@/lib/auth/authorization";
import { can } from "@/lib/auth/policy";
import { resolveCourseAccess } from "@/lib/workspaces/access";
import { DashboardError } from "@/lib/dashboard/rules";
import { audit, securityTransaction } from "./transactions";
import { idSchema, type assignmentSchema, type courseMutationSchema } from "./schemas";

export async function mutateCourse(actorId: string, courseId: string, input: z.infer<typeof courseMutationSchema>, administrative = true) {
  idSchema.parse(courseId);
  return securityTransaction(async (session) => {
    if (administrative) await requireAdmin("courses.manage_all", actorId, session);
    const action = input.action === "transfer" ? "courses.transfer" : input.action === "archive" ? "courses.edit" : "courses.delete";
    const access = await resolveCourseAccess(actorId, courseId, action, { includeDeleted: true, session });
    const course = await Course.findById(courseId).select("+editorSaveLock +generationLockUntil").session(session);
    if (!course) throw new DashboardError("Course not found.", 404);
    if (course.editorSaveLock) throw new DashboardError("The course is being saved. Try again shortly.", 409);
    if (input.action !== "restore" && course.deletedAt) throw new DashboardError("Restore the course before changing it.", 409);
    const changes: Record<string, unknown> = {};
    const metadata: Record<string, unknown> = {};
    if (input.action === "delete") {
      if (input.confirmTitle !== course.title) throw new DashboardError("The title confirmation did not match.", 400);
      changes.deletedAt = new Date();
    } else if (input.action === "restore") {
      if (!course.deletedAt) throw new DashboardError("The course is not deleted.", 409);
      changes.deletedAt = null;
    } else if (input.action === "archive") {
      changes.status = "archived";
    } else {
      const actor = await requireAdmin("courses.transfer", actorId, session);
      if (actor.role !== "super_admin") throw new DashboardError("Only Super Admin can transfer ownership.", 403);
      if (input.confirmTitle !== course.title) throw new DashboardError("The title confirmation did not match.", 400);
      const target = await User.findOne({ email: input.email, deletedAt: null }).session(session).lean();
      if (!target) throw new DashboardError("No eligible new owner was found.", 400);
      const newOwner = await requireActiveUser(target._id.toString(), session);
      if (!can(newOwner, "courses.create") || !can(newOwner, "courses.edit")) throw new DashboardError("The new owner must be an approved author.", 400);
      if (newOwner.id === access.ownerId) throw new DashboardError("That account already owns the course.", 409);
      const running = await GenerationJob.exists({ courseId, $or: [{ status: { $nin: ["completed", "failed", "cancelled"] } }, { leaseUntil: { $gt: new Date() } }] }).session(session);
      const uploading = await Asset.exists({ courseId, status: "pending", createdAt: { $gt: new Date(Date.now() - 600000) } }).session(session);
      if (running || uploading || (course.generationLockUntil && course.generationLockUntil > new Date())) throw new DashboardError("Finish or cancel generation and active uploads before transferring this course.", 409);
      changes.ownerId = new Types.ObjectId(newOwner.id);
      changes.createdBy = course.createdBy ?? course.ownerId;
      changes.workspaceId = null;
      changes.folderId = null;
      metadata.previousOwnerId = access.ownerId;
      metadata.ownerId = newOwner.id;
      metadata.previousWorkspaceId = access.workspaceId;
      // Private S3 keys stay stable. Only the trusted database ownership changes.
      for (const model of [Asset, ExportJob, GenerationJob, GenerationCheckpoint]) {
        await model.updateMany({ courseId, ownerId: access.ownerId }, { $set: { ownerId: newOwner.id } }, { session });
      }
      await CourseAssignment.deleteOne({ courseId, userId: newOwner.id }, { session });
    }
    const result = await Course.updateOne({ _id: courseId, revision: course.revision, editorSaveLock: null }, { $set: changes, $inc: { revision: 1 } }, { session, runValidators: true });
    if (result.modifiedCount !== 1) throw new DashboardError("The course changed. Refresh and try again.", 409);
    await audit(session, { actorId, action: `courses.${input.action}`, targetType: "course", targetId: courseId, metadata });
    return { id: courseId };
  });
}

export async function getCourseAssignments(actorId: string, courseId: string) {
  idSchema.parse(courseId);
  const access = await resolveCourseAccess(actorId, courseId, "courses.assign");
  const assignments = await CourseAssignment.find({ courseId }).sort({ createdAt: 1 }).lean();
  const users = await User.find({ _id: { $in: [access.ownerId, ...assignments.map((assignment) => assignment.userId)] } }).select("name email status").lean();
  const byId = new Map(users.map((user) => [user._id.toString(), user]));
  return {
    owner: { id: access.ownerId, name: byId.get(access.ownerId)?.name ?? "Course owner", email: byId.get(access.ownerId)?.email ?? null },
    assignments: assignments.map((assignment) => {
      const user = byId.get(assignment.userId.toString());
      return { userId: assignment.userId.toString(), role: assignment.role, name: user?.name ?? "User", email: user?.email ?? null, status: user?.status ?? "pending" };
    }),
  };
}

export async function assignCourse(actorId: string, courseId: string, input: z.infer<typeof assignmentSchema>) {
  idSchema.parse(courseId);
  return securityTransaction(async (session) => {
    const access = await resolveCourseAccess(actorId, courseId, "courses.assign", { session });
    const user = await User.findOne({ email: input.email, deletedAt: null }).session(session).lean();
    if (!user) throw new DashboardError("No eligible account was found.", 400);
    const target = await requireActiveUser(user._id.toString(), session);
    if (!can(target, "courses.view") || (input.role === "editor" && !can(target, "courses.edit"))) throw new DashboardError("That account is not eligible for this course role.", 400);
    if (target.id === access.ownerId) throw new DashboardError("The owner already has course access.", 409);
    await CourseAssignment.updateOne({ courseId, userId: target.id }, { $set: { role: input.role, assignedBy: actorId } }, { upsert: true, session, runValidators: true });
    await audit(session, { actorId, action: "courses.assign", targetType: "course", targetId: courseId, metadata: { userId: target.id, role: input.role } });
    return { userId: target.id, role: input.role };
  });
}

export async function removeCourseAssignment(actorId: string, courseId: string, userId: string) {
  idSchema.parse(courseId);
  idSchema.parse(userId);
  return securityTransaction(async (session) => {
    await resolveCourseAccess(actorId, courseId, "courses.assign", { session });
    const removed = await CourseAssignment.deleteOne({ courseId, userId }, { session });
    if (removed.deletedCount !== 1) throw new DashboardError("Assignment not found.", 404);
    await audit(session, { actorId, action: "courses.unassign", targetType: "course", targetId: courseId, metadata: { userId } });
  });
}
