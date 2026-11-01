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
