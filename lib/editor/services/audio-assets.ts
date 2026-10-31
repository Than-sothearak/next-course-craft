import { Asset } from "@/models/Asset";
import { DashboardError } from "@/lib/dashboard/rules";
import type { EditorSnapshotInput } from "../schemas";

export async function assertCourseAudioAssets(ownerId: string, courseId: string, lessons: EditorSnapshotInput["lessons"]) {
  const ids = new Set<string>();
  for (const lesson of lessons) {
    for (const block of lesson.blocks) {
      if ((block.type !== "audio" && block.type !== "audioInstruction") || !block.data.src) continue;
      const id = block.data.src.match(/^\/api\/assets\/([a-f\d]{24})\/file$/i)?.[1];
      if (!id) throw new DashboardError("Choose audio from this course’s media library.", 400);
      ids.add(id.toLowerCase());
    }
  }
  if (!ids.size) return;
  const assets = await Asset.find({
    _id: { $in: [...ids] }, ownerId, courseId, status: "ready", mimeType: /^audio\//,
  }).select("_id").lean();
  if (assets.length !== ids.size)
    throw new DashboardError("Choose audio from this course’s media library.", 400);
}
