import { Asset } from "@/models/Asset";
import { DashboardError } from "@/lib/dashboard/rules";
import type { EditorSnapshotInput } from "../schemas";

export async function assertInteractionButtonAssets(ownerId: string, courseId: string, lessons: EditorSnapshotInput["lessons"]) {
  const groups = { image: new Set<string>(), video: new Set<string>(), audio: new Set<string>() };
  const add = (src: string, kind: keyof typeof groups) => {
    if (!src) return;
    const id = src.match(/^\/api\/assets\/([a-f\d]{24})\/file$/i)?.[1];
    if (!id) throw new DashboardError("Choose interaction button media from this course’s media library.", 400);
    groups[kind].add(id.toLowerCase());
  };
  for (const lesson of lessons) for (const block of lesson.blocks) {
    if (block.type !== "interactionButton") continue;
    add(block.data.imageSrc, "image");
    for (const item of block.data.popup.blocks) if (item.type === "image" || item.type === "video" || item.type === "audio") add(item.data.src, item.type);
  }
  for (const kind of ["image", "video", "audio"] as const) {
    if (!groups[kind].size) continue;
    const assets = await Asset.find({ _id: { $in: [...groups[kind]] }, ownerId, courseId, status: "ready", mimeType: new RegExp(`^${kind}/`) }).select("_id").lean();
    if (assets.length !== groups[kind].size) throw new DashboardError("Choose interaction button media from this course’s media library.", 400);
  }
}
