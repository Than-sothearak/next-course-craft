import { Types } from "mongoose";
import { AuditLog, Course, CourseAssignment, User } from "@/models";
import { can, type Principal } from "@/lib/auth/policy";
import { requireAdmin } from "@/lib/auth/authorization";
import { DashboardError, escapeRegex } from "@/lib/dashboard/rules";
import type { ListQuery } from "./schemas";
import { idSchema } from "./schemas";
import type { AdminCourse, AdminSummary, AdminUser, AdminUserDetail, AuditEntry, PageResult } from "./types";

const pageSize = 20;
const userFields = "name email image role status createdAt updatedAt lastLoginAt deletedAt suspensionReason";
function userScope(principal: Principal) { return principal.role === "super_admin" ? {} : { role: { $nin: ["admin", "super_admin"] } }; }

export function userSummary(user: { _id: Types.ObjectId; name?: string | null; email?: string | null; image?: string | null; role?: string; status?: string; createdAt?: Date; updatedAt?: Date; lastLoginAt?: Date | null; deletedAt?: Date | null; suspensionReason?: string }): AdminUser {
  return { id: user._id.toString(), name: user.name || "Unnamed account", email: user.email ?? null, image: user.image ?? null, role: user.role ?? "viewer", status: user.deletedAt ? "rejected" : (["active", "pending", "suspended", "rejected"].includes(user.status ?? "") ? user.status : "pending") as AdminUser["status"], createdAt: (user.createdAt ?? user._id.getTimestamp()).toISOString(), updatedAt: (user.updatedAt ?? user.createdAt ?? user._id.getTimestamp()).toISOString(), lastLoginAt: user.lastLoginAt?.toISOString() ?? null, deletedAt: user.deletedAt?.toISOString() ?? null, suspensionReason: user.suspensionReason ?? "" };
}

export async function listAdminUsers(actorId: string, query: ListQuery): Promise<PageResult<AdminUser>> {
  const actor = await requireAdmin("users.view", actorId);
  const filter: Record<string, unknown> = { ...userScope(actor) };
  if (query.role) filter.$and = [{ role: query.role }, userScope(actor)];
  if (query.status === "pending") filter.$or = [{ status: "pending" }, { status: { $exists: false } }];
  else if (query.status) filter.status = query.status;
  if (query.q) filter.$and = [...(filter.$and as unknown[] ?? []), { $or: [{ name: new RegExp(escapeRegex(query.q), "i") }, { email: new RegExp(escapeRegex(query.q), "i") }] }];
  const [users, total] = await Promise.all([User.find(filter).select(userFields).sort({ createdAt: -1, _id: -1 }).skip((query.page - 1) * pageSize).limit(pageSize).lean(), User.countDocuments(filter)]);
  return { items: users.map(userSummary), page: query.page, pageSize, total };
}

async function courseRows(courses: Array<{ _id: Types.ObjectId; title: string; status: string; ownerId: Types.ObjectId; workspaceId?: Types.ObjectId | null; createdAt: Date; updatedAt: Date; deletedAt?: Date | null }>): Promise<AdminCourse[]> {
  const owners = await User.find({ _id: { $in: courses.map((course) => course.ownerId) } }).select("name email").lean();
  const names = new Map(owners.map((user) => [user._id.toString(), user]));
  return courses.map((course) => ({ id: course._id.toString(), title: course.title, status: course.status, ownerId: course.ownerId.toString(), ownerName: names.get(course.ownerId.toString())?.name ?? "Course owner", ownerEmail: names.get(course.ownerId.toString())?.email ?? null, createdAt: course.createdAt.toISOString(), updatedAt: course.updatedAt.toISOString(), deletedAt: course.deletedAt?.toISOString() ?? null, workspaceId: course.workspaceId?.toString() ?? null }));
}

export async function listAdminCourses(actorId: string, query: ListQuery): Promise<PageResult<AdminCourse>> {
  const actor = await requireAdmin("courses.manage_all", actorId);
  if (!can(actor, "courses.view")) throw new DashboardError("Access denied.", 403);
  const filter: Record<string, unknown> = {};
  if (query.ownerId) filter.ownerId = query.ownerId;
  if (query.courseStatus === "deleted") filter.deletedAt = { $ne: null };
  else if (query.courseStatus) { filter.status = query.courseStatus; filter.deletedAt = null; }
  if (query.q) filter.title = new RegExp(escapeRegex(query.q), "i");
  const [courses, total] = await Promise.all([Course.find(filter).select("title status ownerId workspaceId createdAt updatedAt deletedAt").sort({ updatedAt: -1, _id: -1 }).skip((query.page - 1) * pageSize).limit(pageSize).lean(), Course.countDocuments(filter)]);
  return { items: await courseRows(courses), page: query.page, pageSize, total };
}

async function auditRows(filter: Record<string, unknown>, page: number, limit = pageSize): Promise<AuditEntry[]> {
  const logs = await AuditLog.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean();
  const actors = await User.find({ _id: { $in: logs.map((log) => log.actorId) } }).select("name email").lean();
  const names = new Map(actors.map((actor) => [actor._id.toString(), actor.name || actor.email || "Administrator"]));
  return logs.map((log) => ({ id: log._id.toString(), actorId: log.actorId.toString(), actorName: names.get(log.actorId.toString()) ?? "Maintenance operator", action: log.action, targetType: log.targetType, targetId: log.targetId?.toString() ?? null, metadata: JSON.parse(JSON.stringify(log.metadata ?? {})) as Record<string, unknown>, createdAt: log.createdAt.toISOString() }));
}

export async function listAuditLogs(actorId: string, query: ListQuery): Promise<PageResult<AuditEntry>> {
  await requireAdmin("audit.view", actorId);
  const filter: Record<string, unknown> = {};
  if (query.actorId) filter.actorId = query.actorId;
  else if (query.q) {
    const actors = await User.find({ $or: [{ name: new RegExp(escapeRegex(query.q), "i") }, { email: new RegExp(escapeRegex(query.q), "i") }] }).select("_id").limit(200).lean();
    filter.actorId = { $in: actors.map((actor) => actor._id) };
  }
  if (query.action) filter.action = query.action;
  if (query.from || query.to) {
    const dates: Record<string, Date> = {};
    if (query.from) dates.$gte = new Date(`${query.from}T00:00:00Z`);
    if (query.to) dates.$lt = new Date(new Date(`${query.to}T00:00:00Z`).getTime() + 86400000);
    if (dates.$gte && dates.$lt && dates.$gte >= dates.$lt) throw new DashboardError("The date range is invalid.", 400);
    filter.createdAt = dates;
  }
  const [items, total] = await Promise.all([auditRows(filter, query.page), AuditLog.countDocuments(filter)]);
  return { items, total, page: query.page, pageSize };
}

export async function getAdminSummary(actorId: string): Promise<AdminSummary> {
  const actor = await requireAdmin("users.view", actorId);
  const scope = userScope(actor);
  const coursesVisible = can(actor, "courses.manage_all") && can(actor, "courses.view");
  const [totalUsers, pending, active, suspended, totalCourses, published, registrations, activity] = await Promise.all([
    User.countDocuments(scope), User.countDocuments({ ...scope, $or: [{ status: "pending" }, { status: { $exists: false } }] }), User.countDocuments({ ...scope, status: "active", deletedAt: null }), User.countDocuments({ ...scope, status: "suspended", deletedAt: null }),
    coursesVisible ? Course.countDocuments({ deletedAt: null }) : null, coursesVisible ? Course.countDocuments({ deletedAt: null, status: "published" }) : null,
    User.find(scope).select(userFields).sort({ createdAt: -1, _id: -1 }).limit(6).lean(), can(actor, "audit.view") ? auditRows({}, 1, 8) : [],
  ]);
  return { counts: { totalUsers, pending, active, suspended, totalCourses, published }, registrations: registrations.map(userSummary), activity };
}

export async function getAdminUserDetail(actorId: string, userId: string): Promise<AdminUserDetail> {
  idSchema.parse(userId);
  const actor = await requireAdmin("users.view", actorId);
  const user = await User.findOne({ _id: userId, ...userScope(actor) }).select(userFields).lean();
  if (!user) throw new DashboardError("Account not found.", 404);
  const assignments = await CourseAssignment.find({ userId }).select("courseId").lean();
  const courses = can(actor, "courses.manage_all") && can(actor, "courses.view") ? await Course.find({ $or: [{ ownerId: userId }, { _id: { $in: assignments.map((assignment) => assignment.courseId) } }] }).sort({ updatedAt: -1 }).limit(100).lean() : [];
  return { user: userSummary(user), courses: await courseRows(courses), activity: can(actor, "audit.view") ? await auditRows({ $or: [{ actorId: new Types.ObjectId(userId) }, { targetType: "user", targetId: new Types.ObjectId(userId) }] }, 1, 20) : [] };
}
