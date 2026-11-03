import { Asset } from "@/models/Asset";
import { DashboardError } from "@/lib/dashboard/rules";
import { resolveCourseAccess } from "@/lib/workspaces/access";
import { deleteStoredMedia } from "../service";
import type { MediaLibraryCursor } from "../schemas";

export async function assertCourseOwner(ownerId: string, courseId: string) {
  return (await resolveCourseAccess(ownerId, courseId, "edit")).ownerId;
}

export async function listCourseMedia(ownerId: string, courseId: string, cursor?: MediaLibraryCursor) {
  const before = cursor ? new Date(cursor.createdAt) : undefined;
  const assets = await Asset.find({ ownerId, courseId, status: "ready", ...(cursor ? { $or: [
    { createdAt: { $lt: before } },
    { createdAt: before, _id: { $lt: cursor.id } },
  ] } : {}) })
    .sort({ createdAt: -1, _id: -1 })
    .limit(101)
    .lean();
  const page = assets.slice(0, 100);
  const last = page.at(-1);
  return {
    assets: page.map((asset) => ({
      id: String(asset._id),
      originalName: asset.originalName,
      contentType: asset.mimeType,
      size: asset.size,
      fileUrl: `/api/assets/${asset._id}/file`,
      createdAt: asset.createdAt,
    })),
    nextCursor: assets.length > 100 && last ? `${last.createdAt.toISOString()}~${last._id}` : null,
  };
}

export async function deleteCourseMediaAsset(ownerId: string, courseId: string, assetId: string) {
  const asset = await Asset.findOne({ _id: assetId, ownerId, courseId, status: "ready" });
  if (!asset) throw new DashboardError("Media asset not found.", 404);

  try {
    await deleteStoredMedia(asset);
  } catch {
    throw new DashboardError("The file could not be deleted from storage. Please try again.", 502);
  }

  await Asset.deleteOne({ _id: asset._id, ownerId, courseId });
}
