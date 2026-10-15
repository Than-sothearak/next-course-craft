import { Asset } from "@/models/Asset";
import { DashboardError } from "@/lib/dashboard/rules";
import type { CourseCover } from "../course-cover";

export async function assertCourseCoverAsset(ownerId: string, courseId: string, cover?: CourseCover) {
  if (!cover?.imageSrc) return;
  const assetId = cover.imageSrc.match(/^\/api\/assets\/([a-f\d]{24})\/file$/i)?.[1];
  if (!assetId) throw new DashboardError("Choose a cover image from this course’s media library.", 400);
  const asset = await Asset.findOne({ _id: assetId, ownerId, courseId, status: "ready", mimeType: /^image\// }).select("_id").lean();
  if (!asset) throw new DashboardError("Choose a cover image from this course’s media library.", 400);
}
