import { Asset } from "@/models/Asset";
import { DashboardError } from "@/lib/dashboard/rules";

export async function getOwnedMediaAsset(ownerId: string, assetId: string) {
  const asset = await Asset.findOne({ _id: assetId, ownerId, status: "ready" }).lean();
  if (!asset) throw new DashboardError("Media asset not found.", 404);
  return asset;
}
