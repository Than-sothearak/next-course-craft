import { createTemplateContent } from "./templates";
import type { SlideTemplateId } from "./template-definitions";
import { createLearningBlock, type LearningBlock, type ObjectPlacement } from "./blocks";

/** A layout inserts independent editable objects, rather than a vertically stacked content section. */
export function createObjectLayout(id: SlideTemplateId, firstZIndex = 1): LearningBlock[] {
  const template = createTemplateContent(id), layers: LearningBlock[] = [];
  const imageRight = id !== "image-text";
  const hasImage = !!template.slots.image;
  const put = (block: LearningBlock, bounds: Pick<ObjectPlacement, "x" | "y" | "width" | "height">) => layers.push({ ...block, placement: { ...bounds, rotation: 0, zIndex: Math.min(500, firstZIndex + layers.length) } });
  let bodyIndex = 0;
  for (const [key, slot] of Object.entries(template.slots)) {
    if (slot.type === "text") {
      const title = key === "title", eyebrow = key === "eyebrow";
      const block = { ...createLearningBlock("text"), kind: "text" as const, name: title ? "Layout heading" : eyebrow ? "Layout label" : "Layout text", heading: title ? slot.content : "", body: title ? "" : slot.content, appearance: { headingSize: id === "cover" ? 64 : 42, fontSize: eyebrow ? 16 : 24 } };
      const x = hasImage && !title && !eyebrow ? imageRight ? 80 : 720 : 80;
      put(block, { x, y: eyebrow ? 32 : title ? 70 : 180 + bodyIndex++ * 220, width: hasImage && !title && !eyebrow ? 480 : 1120, height: eyebrow ? 32 : title ? 100 : 200 });
    } else if (slot.type === "image") put({ ...createLearningBlock("image"), kind: "image", name: "Layout image", src: slot.src, alt: slot.alt }, id === "full-image" ? { x: 0, y: 0, width: 1280, height: 720 } : { x: imageRight ? 720 : 80, y: 180, width: 480, height: 400 });
    else if (slot.type === "button") put({ ...createLearningBlock("button"), kind: "button", label: slot.label, action: slot.action, visible: slot.visible }, { x: 920, y: 620, width: 280, height: 64 });
    else if (slot.type === "list") {
      const columns = Math.min(3, slot.items.length), width = (1120 - (columns - 1) * 24) / columns;
      slot.items.forEach((item, index) => put({ ...createLearningBlock("text"), kind: "text", name: item.title || `Card ${index + 1}`, heading: item.title, body: item.body, appearance: { headingSize: 28, fontSize: 22, backgroundColor: "#f1f5f9", radius: 16 } }, { x: 80 + index % columns * (width + 24), y: 200 + Math.floor(index / columns) * 230, width, height: 210 }));
    }
  }
  if (id === "full-image") {
    const arranged = [...layers.filter((layer) => layer.kind === "image"), ...layers.filter((layer) => layer.kind !== "image")];
    return arranged.map((layer, index) => ({ ...layer, placement: { ...layer.placement!, zIndex: Math.min(500, firstZIndex + index) }, ...(layer.kind === "text" ? { appearance: { ...layer.appearance, backgroundColor: "#ffffff", color: "#172033" } } : {}) }));
  }
  return layers;
}
