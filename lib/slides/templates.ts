import { getSlideTemplate, type SlideTemplateId } from "./template-definitions";
import { slideTemplateContentSchema, templateDesignSchema, type SlideTemplateContent, type TemplateSlot } from "./template-schema";
import { slideSnapshotSchema, type SlideSnapshot } from "./schema";

export function createTemplateContent(id: SlideTemplateId): SlideTemplateContent {
  const definition = getSlideTemplate(id);
  const slots: Record<string, TemplateSlot> = {};
  for (const slot of definition.slots) {
    if (slot.type === "text") slots[slot.key] = { type: "text", content: slot.sample ?? "" };
    else if (slot.type === "image") slots[slot.key] = { type: "image", src: "", alt: "" };
    else if (slot.type === "button") slots[slot.key] = { type: "button", label: slot.sample ?? "Continue", visible: true, action: "nextSlide" };
    else slots[slot.key] = { type: "list", items: (slot.items ?? []).map((item) => ({ ...item, id: crypto.randomUUID() })) };
  }
  return slideTemplateContentSchema.parse({ id, version: definition.version, slots });
}
export function replaceSlideTemplate(current: SlideTemplateContent, id: SlideTemplateId): SlideTemplateContent {
  const next = createTemplateContent(id);
  const available = structuredClone({ ...current.retainedSlots, ...current.slots });
  const retainedSlots = { ...available };
  for (const [key, slot] of Object.entries(next.slots)) {
    const previous = available[key];
    if (previous?.type === slot.type) {
      // All shared text slots have compatible limits; keep authored content verbatim.
      next.slots[key] = previous;
      delete retainedSlots[key];
    }
  }
  return slideTemplateContentSchema.parse({ ...next, retainedSlots });
}
export function resetTemplateDesign(template: SlideTemplateContent): SlideTemplateContent {
  return { ...template, design: templateDesignSchema.parse({}) };
}
export function createTemplateSlide(id: SlideTemplateId, order: number, title?: string): SlideSnapshot {
  return slideSnapshotSchema.parse({ title: title ?? getSlideTemplate(id).name, order, objects: [], template: createTemplateContent(id), schemaVersion: 2, revision: 0 });
}
