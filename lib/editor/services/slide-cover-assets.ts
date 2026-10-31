import { Asset } from "@/models/Asset";
import { DashboardError } from "@/lib/dashboard/rules";
import type { EditorSnapshotInput } from "../schemas";

export async function assertSlideCoverAssets(ownerId: string, courseId: string, lessons: EditorSnapshotInput["lessons"]) {
  for (const lesson of lessons) {
    const cover = lesson.slideCover;
    for (const { src, type, message } of [
      { src: cover?.imageSrc, type: /^image\//, message: "Choose a slide cover image from this course’s media library." },
      { src: cover?.instructions?.audioSrc, type: /^audio\//, message: "Choose cover instruction audio from this course’s media library." },
    ]) {
      if (!src) continue;
      const assetId = src.match(/^\/api\/assets\/([a-f\d]{24})\/file$/i)?.[1];
      if (!assetId) throw new DashboardError(message, 400);
      const asset = await Asset.findOne({ _id: assetId, ownerId, courseId, status: "ready", mimeType: type }).select("_id").lean();
      if (!asset) throw new DashboardError(message, 400);
    }
  }
}
