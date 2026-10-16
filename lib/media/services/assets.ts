import { Asset } from "@/models/Asset";
import { DashboardError } from "@/lib/dashboard/rules";
import { resolveCourseAccess } from "@/lib/workspaces/access";

export async function getOwnedMediaAsset(userId: string, assetId: string) {
  const asset = await Asset.findOne({ _id: assetId, status: "ready" }).lean();
  if (!asset) throw new DashboardError("Media asset not found.", 404);
  if (asset.courseId) {
    await resolveCourseAccess(userId, asset.courseId.toString(), "view");
  } else if (asset.ownerId.toString() !== userId) {
    throw new DashboardError("Media asset not found.", 404);
  }
  return asset;
}
