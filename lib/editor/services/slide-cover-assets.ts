import { Asset } from "@/models/Asset";
import { DashboardError } from "@/lib/dashboard/rules";
import type { EditorSnapshotInput } from "../schemas";

export async function assertSlideCoverAssets(ownerId: string, courseId: string, lessons: EditorSnapshotInput["lessons"]) {
  for (const lesson of lessons) {
    const imageSrc = lesson.slideCover?.imageSrc;
    if (!imageSrc) continue;
    const assetId = imageSrc.match(/^\/api\/assets\/([a-f\d]{24})\/file$/i)?.[1];
    if (!assetId) throw new DashboardError("Choose a slide cover image from this course’s media library.", 400);
    const asset = await Asset.findOne({ _id: assetId, ownerId, courseId, status: "ready", mimeType: /^image\// }).select("_id").lean();
    if (!asset) throw new DashboardError("Choose a slide cover image from this course’s media library.", 400);
  }
}
