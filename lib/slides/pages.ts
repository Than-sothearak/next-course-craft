import { masterSettingsForSlide } from "./master-schema";
import { learningBlockSchema, type LearningBlock } from "./blocks";
import type { SlideRecord } from "./schema";
import { materializeObjectCanvas, moveCanvasObject } from "./object-canvas";

/** Wrap existing structured content without flattening or discarding authored slots. */
export function composeLearningPage(slide: SlideRecord): SlideRecord {
  if (slide.composition) return slide;
  if (slide.objects.length) throw new Error("Keep this canvas intact. Add a new content page to use prebuilt blocks.");
  const layers: LearningBlock[] = slide.template ? [learningBlockSchema.parse({ id: crypto.randomUUID(), name: slide.title, kind: "template", content: structuredClone(slide.template) })] : [];
  const { template, ...rest } = slide;
  void template;
  return { ...rest, masterOverrides: undefined, numbering: undefined, schemaVersion: 3, composition: materializeObjectCanvas({ duration: 30, layers, ...masterSettingsForSlide(slide) }) };
}

export function duplicateLearningBlock(layer: LearningBlock): LearningBlock {
  const copy = { ...structuredClone(layer), id: crypto.randomUUID(), name: `${layer.name} copy`.slice(0, 160), locked: false };
  if (copy.placement) copy.placement = { ...moveCanvasObject(copy.placement, copy.placement.x + 24, copy.placement.y + 24), zIndex: Math.min(500, copy.placement.zIndex + 1) };
  return copy;
}
