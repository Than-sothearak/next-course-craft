import { Asset } from "@/models/Asset";
import { DashboardError } from "@/lib/dashboard/rules";
import { courseAssetIds } from "@/lib/media/asset-references";
import type { ContentBlock } from "@/lib/schemas/block";
import type { EditorSnapshotInput } from "../schemas";

export async function assertInteractionButtonAssets(ownerId: string, courseId: string, lessons: EditorSnapshotInput["lessons"]) {
  const groups = { image: new Set<string>(), video: new Set<string>(), audio: new Set<string>(), attachment: new Set<string>(), other: new Set<string>() };
  const add = (src: string, kind: keyof typeof groups, libraryOnly = true) => {
    if (!src) return;
    const id = src.match(/^\/api\/assets\/([a-f\d]{24})\/file$/i)?.[1];
    if (!id) {
      if (libraryOnly) throw new DashboardError("Choose interactive media from this course's media library.", 400);
      return;
    }
    groups[kind].add(id.toLowerCase());
  };
  function visit(block: ContentBlock) {
    if (block.type === "interactionButton") {
      add(block.data.imageSrc, "image");
      block.data.popup.blocks.forEach(visit);
    } else if (block.type === "hangingRopeCards") block.data.cards.forEach((card) => card.blocks.forEach(visit));
    else if (block.type === "peelToReveal") block.data.blocks.forEach(visit);
    else if (block.type === "image" || block.type === "video" || block.type === "audio") add(block.data.src, block.type);
    else if (block.type === "audioInstruction") add(block.data.src, "audio");
    else if (block.type === "attachment") add(block.data.src, "attachment");
    else if (block.type === "processSteps") for (const step of block.data.steps) {
      if (step.media) {
        const kind = step.media.mimeType.split("/")[0];
        add(step.media.src, kind === "image" || kind === "video" || kind === "audio" ? kind : "attachment");
      }
      if (step.attachment) add(step.attachment.src, "attachment");
    }
    else if (block.type === "gallery") block.data.images.forEach((image) => add(image.src, "image", false));
    else if (block.type === "labeledGraphic") add(block.data.src, "image", false);
    else if (block.type === "flipCard") for (const card of block.data.cards) {
      if (card.front.type === "image") add(card.front.src, "image", false);
      if (card.back.type === "image") add(card.back.src, "image", false);
    }
  }
  for (const lesson of lessons) for (const block of lesson.blocks) {
    if (block.type !== "interactionButton" && block.type !== "peelToReveal" && block.type !== "hangingRopeCards" && block.type !== "processSteps" && block.type !== "timeline") continue;
    visit(block);
    for (const id of courseAssetIds(block)) groups.other.add(id);
  }
  for (const kind of ["image", "video", "audio", "attachment"] as const) for (const id of groups[kind]) groups.other.delete(id);
  for (const kind of ["image", "video", "audio", "attachment", "other"] as const) {
    if (!groups[kind].size) continue;
    const assets = await Asset.find({ _id: { $in: [...groups[kind]] }, ownerId, courseId, status: "ready", ...(["image", "video", "audio"].includes(kind) ? { mimeType: new RegExp(`^${kind}/`) } : {}) }).select("_id").lean();
    if (assets.length !== groups[kind].size) throw new DashboardError("Choose interactive media from this course's media library.", 400);
  }
}
