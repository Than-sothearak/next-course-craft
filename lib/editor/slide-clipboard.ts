import { z } from "zod";
import { blockSchema, type ContentBlock } from "@/lib/schemas/block";
import { duplicateLessonBlocks } from "./course-content";
import { resolveSlideFrame, type SlideSize } from "./slide-design";

export const slideObjectClipboardType = "application/x-coursecraft-slide-object+json";
const clipboardFormat = "coursecraft-slide-object";
const clipboardSchema = z.object({
  format: z.literal(clipboardFormat),
  version: z.literal(1),
  courseId: z.string().min(1).max(64),
  block: blockSchema,
});
const selectionClipboardSchema = z.object({ format: z.literal(clipboardFormat), version: z.literal(2), courseId: z.string().min(1).max(64), blocks: z.array(blockSchema).min(1).max(500).refine((blocks) => new Set(blocks.map((block) => block.id)).size === blocks.length, "Copied object IDs must be unique.") });

export function serializeSlideObjects(courseId: string, blocks: ContentBlock[], ids: readonly string[], area: SlideSize): string {
  return JSON.stringify(selectionClipboardSchema.parse({ format: clipboardFormat, version: 2, courseId,
    blocks: blocks.flatMap((block, index) => ids.includes(block.id) ? [{ ...block, slideFrame: resolveSlideFrame(block, index, blocks.length, area) }] : []),
  }));
}

export function readSlideObjectsClipboard(text: string, courseId: string): ContentBlock[] | null {
  let value: unknown;
  try { value = JSON.parse(text); } catch { return null; }
  if (!value || typeof value !== "object" || !("format" in value) || value.format !== clipboardFormat) return null;
  if (!("version" in value) || value.version !== 2) {
    const block = readSlideObjectClipboard(text, courseId); return block ? [block] : null;
  }
  const parsed = selectionClipboardSchema.safeParse(value);
  if (!parsed.success) throw new Error("This copied object is invalid. Copy the selection again.");
  if (parsed.data.courseId !== courseId) throw new Error("Copy objects from this course to paste them onto this slide.");
  return parsed.data.blocks;
}

export function appendSlideObjects(sources: ContentBlock[], destination: ContentBlock[], createId: () => string) {
  const copies = duplicateLessonBlocks(sources, createId);
  const ids = new Map(sources.map((source, index) => [source.id, copies[index].id]));
  const order = sources.map((block, index) => ({ index, z: block.slideFrame?.z ?? index })).sort((a, b) => a.z - b.z || a.index - b.index);
  const ranks = new Map(order.map((item, index) => [item.index, index]));
  const maximum = Math.max(-1, ...destination.map((block, index) => block.slideFrame?.z ?? index));
  const overflow = maximum + copies.length > 500;
  const destinationOrder = destination.map((block, index) => ({ id: block.id, index, z: block.slideFrame?.z ?? index })).sort((a, b) => a.z - b.z || a.index - b.index);
  const destinationRanks = new Map(destinationOrder.map((item, index) => [item.id, index]));
  const blocks = overflow ? destination.map((block, index) => ({ ...block, slideFrame: { ...(block.slideFrame ?? resolveSlideFrame(block, index, destination.length)), z: destinationRanks.get(block.id)! } })) : destination;
  const pasted = copies.map((copy, index) => {
    const source = sources[index];
    const next = { ...copy, slideLocked: undefined, slideHiddenInEditor: undefined, slideFrame: { ...(source.slideFrame ?? resolveSlideFrame(source, index, sources.length)), z: (overflow ? destination.length : maximum + 1) + ranks.get(index)! } };
    if (next.type === "interactionButton" && source.type === "interactionButton") return { ...next, data: { ...next.data, targetBlockId: ids.get(source.data.targetBlockId) ?? (destination.some((block) => block.id === source.data.targetBlockId) ? source.data.targetBlockId : "") } };
    return next;
  });
  return { blocks: [...blocks, ...pasted], selectedIds: pasted.map((block) => block.id) };
}

export function serializeSlideObject(courseId: string, block: ContentBlock, index: number, total: number, area: SlideSize): string {
  return JSON.stringify(clipboardSchema.parse({
    format: clipboardFormat, version: 1, courseId,
    block: { ...block, slideFrame: resolveSlideFrame(block, index, total, area) },
  }));
}

/** Ignore ordinary clipboard text; validate our versioned object before using it. */
export function readSlideObjectClipboard(text: string, courseId: string): ContentBlock | null {
  let value: unknown;
  try { value = JSON.parse(text); } catch { return null; }
  if (!value || typeof value !== "object" || !("format" in value) || value.format !== clipboardFormat) return null;
  const parsed = clipboardSchema.safeParse(value);
  if (!parsed.success) throw new Error("This copied object is invalid. Copy the object again.");
  if (parsed.data.courseId !== courseId) throw new Error("Copy an object from this course to paste it onto this slide.");
  return parsed.data.block;
}

/** Keep geometry unchanged, regenerate nested object IDs, and paint the copy on top. */
export function pasteSlideObject(source: ContentBlock, destination: ContentBlock[], createId: () => string): ContentBlock {
  let copy = duplicateLessonBlocks([source], createId)[0];
  if (copy.type === "interactionButton" && source.type === "interactionButton" && source.data.targetBlockId !== source.id) {
    copy = { ...copy, data: { ...copy.data, targetBlockId: destination.some((block) => block.id === source.data.targetBlockId) ? source.data.targetBlockId : "" } };
  }
  const frame = source.slideFrame ?? resolveSlideFrame(source, 0, 1);
  const z = Math.min(500, Math.max(-1, ...destination.map((block, index) => block.slideFrame?.z ?? index)) + 1);
  return blockSchema.parse({ ...copy, slideFrame: { ...frame, z } });
}
