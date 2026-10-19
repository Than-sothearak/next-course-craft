import { Asset } from "@/models/Asset";
import { DashboardError } from "@/lib/dashboard/rules";
import { resolveCourseAccess } from "@/lib/workspaces/access";
import { deleteStoredMedia } from "../service";

export async function assertCourseOwner(ownerId: string, courseId: string) {
  return (await resolveCourseAccess(ownerId, courseId, "edit")).ownerId;
}

export async function listCourseMedia(ownerId: string, courseId: string) {
  const assets = await Asset.find({ ownerId, courseId, status: "ready" })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  return assets.map((asset) => ({
    id: String(asset._id),
    originalName: asset.originalName,
    contentType: asset.mimeType,
    size: asset.size,
    fileUrl: `/api/assets/${asset._id}/file`,
    createdAt: asset.createdAt,
  }));
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
