import { randomBytes } from "node:crypto";
import { z } from "zod";
import { Course, Asset } from "@/models";
import { DashboardError } from "@/lib/dashboard/rules";
import { objectIdSchema } from "@/lib/dashboard/schemas";
import { getCourseAuthorName, getCourseEditor } from "@/lib/editor/services/course";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { validateQuizAssessments } from "@/lib/interactive/quiz-assessment";
import { courseAssetIds, remapCourseAssetUrls } from "@/lib/media/asset-references";
import { resolveCourseAccess } from "@/lib/workspaces/access";
import type { PreviewData } from "@/app/courses/[courseId]/preview/course-preview";

export const shareTokenSchema = z.string().regex(/^[a-f\d]{48}$/);

async function publishingAccess(userId: string, courseId: string) {
  if (!objectIdSchema.safeParse(courseId).success) throw new DashboardError("Course not found.", 404);
  const access = await resolveCourseAccess(userId, courseId, "courses.publish");
  await resolveCourseAccess(userId, courseId, "courses.export");
  return access;
}

function shareDetails(share: { token: string; publishedAt: Date } | null | undefined) {
  return share ? { path: `/share/${share.token}`, publishedAt: share.publishedAt.toISOString() } : null;
}

export async function getCourseShare(userId: string, courseId: string) {
  const { ownerId } = await publishingAccess(userId, courseId);
  const course = await Course.findOne({ _id: courseId, ownerId, deletedAt: null }).select("publicShare.token publicShare.publishedAt").lean();
  if (!course) throw new DashboardError("Course not found.", 404);
  return shareDetails(course.publicShare);
}

export async function publishCourseShare(userId: string, courseId: string) {
  const { ownerId } = await publishingAccess(userId, courseId);
  const course = await Course.findOne({ _id: courseId, ownerId, deletedAt: null, editorSaveLock: null }).select("revision publicShare.token").lean();
  if (!course) throw new DashboardError("The course is unavailable or being saved. Try again in a moment.", 409);
  const parsed = editorSnapshotSchema.safeParse(await getCourseEditor(ownerId, courseId));
  if (!parsed.success) throw new DashboardError("Save valid course content before publishing a share link.", 422);
  const issue = validateQuizAssessments(parsed.data.lessons);
  if (issue) throw new DashboardError(issue, 422);
  const { revision, ...content } = parsed.data;
  if (revision !== course.revision) throw new DashboardError("The course changed while publishing. Try again after saving.", 409);
  if (!content.lessons.length) throw new DashboardError("Add a lesson before publishing a share link.", 422);
  const snapshot: PreviewData = { ...content, courseId };
  if (Buffer.byteLength(JSON.stringify(snapshot)) > 12 * 1024 * 1024) {
    throw new DashboardError("This course is too large for a share link. Use an HTML export instead.", 422);
  }
  const assetIds = [...courseAssetIds(snapshot)];
  const assetCount = await Asset.countDocuments({ _id: { $in: assetIds }, ownerId, courseId, status: "ready" });
  if (assetCount !== assetIds.length) throw new DashboardError("Some course media is missing or belongs to another course. Replace it before publishing.", 409);
  const authorName = await getCourseAuthorName(ownerId, courseId);
  const share = {
    token: course.publicShare?.token ?? randomBytes(24).toString("hex"),
    snapshot, authorName, assetIds, publishedAt: new Date(),
  };
  // One atomic write publishes the complete snapshot. Revision/lock/token guards
  // reject overlapping saves, publications and revocations without changing drafts.
  const updated = await Course.updateOne({
    _id: courseId, ownerId, deletedAt: null, editorSaveLock: null,
    revision: course.revision,
    "publicShare.token": course.publicShare?.token ?? null,
  }, { $set: { publicShare: share, status: "published" } }, { runValidators: true });
  if (updated.matchedCount !== 1) {
    throw new DashboardError("The course changed while publishing. Try again after saving.", 409);
  }
  return shareDetails(share)!;
}

export async function revokeCourseShare(userId: string, courseId: string) {
  const { ownerId } = await publishingAccess(userId, courseId);
  const course = await Course.findOne({ _id: courseId, ownerId, deletedAt: null }).select("status publicShare.token").lean();
  if (!course) throw new DashboardError("Course not found.", 404);
  const result = await Course.updateOne({
    _id: courseId, ownerId, deletedAt: null, status: course.status,
    "publicShare.token": course.publicShare?.token ?? null,
  }, { $unset: { publicShare: "" }, ...(course.status === "published" ? { $set: { status: "draft" } } : {}) });
  if (!result.matchedCount) throw new DashboardError("The course changed. Try turning off the link again.", 409);
}

export async function getPublicCourse(token: string) {
  if (!shareTokenSchema.safeParse(token).success) throw new DashboardError("Shared course not found.", 404);
  const course = await Course.findOne({ "publicShare.token": token, deletedAt: null })
    .select("+publicShare.snapshot publicShare.authorName publicShare.assetIds ownerId").lean();
  if (!course?.publicShare?.snapshot) throw new DashboardError("Shared course not found.", 404);
  const share = course.publicShare;
  const sources = new Map(share.assetIds.map((id) => [String(id), `/api/shared-courses/${token}/assets/${id}`]));
  return {
    courseId: String(course._id), ownerId: String(course.ownerId),
    assetIds: share.assetIds.map(String), authorName: share.authorName,
    data: remapCourseAssetUrls(share.snapshot as PreviewData, sources),
  };
}

export async function getPublicCourseAsset(token: string, assetId: string) {
  if (!shareTokenSchema.safeParse(token).success || !objectIdSchema.safeParse(assetId).success) {
    throw new DashboardError("Media asset not found.", 404);
  }
  const course = await Course.findOne({ "publicShare.token": token, "publicShare.assetIds": assetId, deletedAt: null }).select("ownerId").lean();
  if (!course) throw new DashboardError("Media asset not found.", 404);
  const asset = await Asset.findOne({ _id: assetId, courseId: course._id, ownerId: course.ownerId, status: "ready" }).lean();
  if (!asset) throw new DashboardError("Media asset not found.", 404);
  return asset;
}
