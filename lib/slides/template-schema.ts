import { z } from "zod";
import { slideTemplateIds, getSlideTemplate } from "./template-definitions";
import { slideMediaSourceSchema } from "./media-source";
import { slideThemeOverridesSchema } from "./themes";

export const templateSlotSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), content: z.string().max(5_000) }).strict(),
  z.object({ type: z.literal("image"), src: slideMediaSourceSchema, alt: z.string().max(500).default("") }).strict(),
  z.object({ type: z.literal("list"), items: z.array(z.object({ id: z.string().min(1).max(64), title: z.string().max(160), body: z.string().max(1_000) }).strict()).min(1).max(6) }).strict(),
  z.object({ type: z.literal("button"), label: z.string().max(80), action: z.enum(["nextSlide", "previousSlide"]).default("nextSlide"), visible: z.boolean().default(true) }).strict(),
]);
const slotsSchema = z.record(z.string().regex(/^[a-z][a-zA-Z0-9]*$/).max(32), templateSlotSchema).refine((slots) => Object.keys(slots).length <= 24, "A template can contain up to 24 content slots.");
export const templateDesignSchema = z.object({
  variant: z.enum(["default", "alternate", "centered"]).default("default"),
  density: z.enum(["theme", "compact", "comfortable", "spacious"]).default("theme"),
  background: z.enum(["theme", "primary", "soft"]).default("theme"),
  imageFit: z.enum(["cover", "contain"]).default("cover"),
  imagePosition: z.enum(["center", "top", "bottom"]).default("center"),
  themeOverrides: slideThemeOverridesSchema.default({}),
}).strict();
export const slideTemplateContentSchema = z.object({
  id: z.enum(slideTemplateIds),
  version: z.literal(1),
  slots: slotsSchema,
  retainedSlots: slotsSchema.default({}),
  design: templateDesignSchema.default({ variant: "default", density: "theme", background: "theme", imageFit: "cover", imagePosition: "center", themeOverrides: {} }),
}).strict().superRefine((content, context) => {
  const definition = getSlideTemplate(content.id);
  for (const slot of definition.slots) {
    const value = content.slots[slot.key];
    if (!value || value.type !== slot.type) context.addIssue({ code: "custom", path: ["slots", slot.key], message: `${slot.label} must be a ${slot.type} slot.` });
    if (value?.type === "text" && value.content.length > (slot.maximum ?? 5_000)) context.addIssue({ code: "custom", path: ["slots", slot.key, "content"], message: `${slot.label} is too long for this layout.` });
    if (value?.type === "list" && new Set(value.items.map((item) => item.id)).size !== value.items.length) context.addIssue({ code: "custom", path: ["slots", slot.key, "items"], message: "Content item identifiers must be unique." });
  }
  for (const key of Object.keys(content.slots)) if (!definition.slots.some((slot) => slot.key === key)) context.addIssue({ code: "custom", path: ["slots", key], message: "This content slot does not belong to the selected template." });
});
export type TemplateSlot = z.infer<typeof templateSlotSchema>;
export type SlideTemplateContent = z.infer<typeof slideTemplateContentSchema>;
export type TemplateDesign = z.infer<typeof templateDesignSchema>;
