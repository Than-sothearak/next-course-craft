import { masterOverridesSchema, slideNumberOverrideSchema } from "./master-schema";
import { z } from "zod";
import { slideMediaSourceSchema } from "./media-source";
import { slideTemplateContentSchema } from "./template-schema";
import { slideTemplateIds } from "./template-definitions";
import { learningPageSchema } from "./blocks";

export const slideWidth = 1280;
export const slideHeight = 720;

export const slideObjectTypeSchema = z.enum(["text", "image", "video", "button", "shape"]);
export const slideLayoutSchema = z.enum(["blank", "title", "titleContent", "twoColumn"]);
const hexColorSchema = z.string().regex(/^#[\da-fA-F]{6}$/);
const mediaSourceSchema = slideMediaSourceSchema;
const safeExternalUrlSchema = z.string().url().max(2_048).refine((value) => {
  try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
}, "Links must use HTTP or HTTPS.");
export const slideActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("showObject"), targetObjectId: z.string().min(1).max(64) }).strict(),
  z.object({ type: z.literal("hideObject"), targetObjectId: z.string().min(1).max(64) }).strict(),
  z.object({ type: z.literal("setState"), targetObjectId: z.string().min(1).max(64), stateId: z.string().min(1).max(64) }).strict(),
  z.object({ type: z.literal("nextSlide") }).strict(),
  z.object({ type: z.literal("previousSlide") }).strict(),
  z.object({ type: z.literal("goToSlide"), slideId: z.string().min(1).max(64) }).strict(),
  z.object({ type: z.literal("feedback"), message: z.string().trim().min(1).max(2_000) }).strict(),
  z.object({ type: z.literal("openUrl"), url: safeExternalUrlSchema }).strict(),
]);
export const slideLifecycleActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("showObject"), targetObjectId: z.string().min(1).max(64) }).strict(),
  z.object({ type: z.literal("hideObject"), targetObjectId: z.string().min(1).max(64) }).strict(),
  z.object({ type: z.literal("setState"), targetObjectId: z.string().min(1).max(64), stateId: z.string().min(1).max(64) }).strict(),
  z.object({ type: z.literal("feedback"), message: z.string().trim().min(1).max(2_000) }).strict(),
]);

export const slideObjectStyleSchema = z.object({
  color: hexColorSchema.default("#172033"),
  backgroundColor: hexColorSchema.default("#ffffff"),
  borderColor: hexColorSchema.default("#d6dce7"),
  borderWidth: z.number().int().min(0).max(24).default(0),
  borderRadius: z.number().int().min(0).max(80).default(0),
  opacity: z.number().min(0).max(1).default(1),
  fontSize: z.number().int().min(8).max(160).default(32),
  fontWeight: z.enum(["normal", "medium", "semibold", "bold"]).default("normal"),
  textAlign: z.enum(["left", "center", "right"]).default("left"),
}).strict();

export const slideObjectStateSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().trim().min(1).max(80),
  content: z.string().max(5_000).optional(),
  visible: z.boolean().optional(),
  style: slideObjectStyleSchema.partial().strict().default({}),
}).strict();
const slideObjectBase = {
  id: z.string().min(1).max(64),
  x: z.number().int().min(0).max(slideWidth),
  y: z.number().int().min(0).max(slideHeight),
  width: z.number().int().min(1).max(slideWidth),
  height: z.number().int().min(1).max(slideHeight),
  rotation: z.number().int().min(-180).max(180).default(0),
  zIndex: z.number().int().min(0).max(500).default(1),
  visible: z.boolean().default(true),
  style: slideObjectStyleSchema.default({
    color: "#172033", backgroundColor: "#ffffff", borderColor: "#d6dce7",
    borderWidth: 0, borderRadius: 0, opacity: 1, fontSize: 32,
    fontWeight: "normal", textAlign: "left",
  }),
  actions: z.array(slideActionSchema).max(20).default([]),
  states: z.array(slideObjectStateSchema).max(10).default([]),
  activeStateId: z.string().min(1).max(64).optional(),
};

export const slideObjectSchema = z.discriminatedUnion("type", [
  z.object({ ...slideObjectBase, type: z.literal("text"), content: z.string().max(5_000) }).strict(),
  z.object({ ...slideObjectBase, type: z.literal("image"), content: mediaSourceSchema, alt: z.string().max(500).default("") }).strict(),
  z.object({ ...slideObjectBase, type: z.literal("video"), content: mediaSourceSchema }).strict(),
  z.object({ ...slideObjectBase, type: z.literal("button"), content: z.string().max(300) }).strict(),
  z.object({ ...slideObjectBase, type: z.literal("shape"), content: z.enum(["rectangle", "ellipse", "line"]) }).strict(),
]).superRefine((object, context) => {
  if (object.x + object.width > slideWidth)
    context.addIssue({ code: "custom", path: ["width"], message: "Object must fit inside the slide width." });
  if (object.y + object.height > slideHeight)
    context.addIssue({ code: "custom", path: ["height"], message: "Object must fit inside the slide height." });
  const stateIds = object.states.map((state) => state.id);
  if (new Set(stateIds).size !== stateIds.length)
    context.addIssue({ code: "custom", path: ["states"], message: "Object state identifiers must be unique." });
  if (object.activeStateId && !stateIds.includes(object.activeStateId))
    context.addIssue({ code: "custom", path: ["activeStateId"], message: "Choose a state that exists on this object." });
});

export const slideSnapshotSchema = z.object({
  title: z.string().trim().min(1).max(160),
  order: z.number().int().min(0).max(500),
  layout: slideLayoutSchema.default("blank"),
  width: z.literal(slideWidth).default(slideWidth),
  height: z.literal(slideHeight).default(slideHeight),
  background: z.object({ color: hexColorSchema.default("#ffffff") }).strict().default({ color: "#ffffff" }),
  objects: z.array(slideObjectSchema).max(200),
  template: slideTemplateContentSchema.optional(),
  composition: learningPageSchema.optional(),
  masterOverrides: masterOverridesSchema.optional(),
  numbering: slideNumberOverrideSchema.optional(),
  interactions: z.array(z.object({ event: z.enum(["slideEnter", "slideExit"]), action: slideLifecycleActionSchema }).strict()).max(40).default([]),
  notes: z.string().max(10_000).default(""),
  schemaVersion: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(1),
  revision: z.number().int().min(0),
}).strict().superRefine((slide, context) => {
  if (slide.composition && (slide.schemaVersion !== 3 || slide.template || slide.objects.length))
    context.addIssue({ code: "custom", path: ["composition"], message: "Content pages use schema version 3 with blocks stored as layers." });
  if (slide.schemaVersion === 3 && !slide.composition)
    context.addIssue({ code: "custom", path: ["composition"], message: "A content page needs its block composition." });
  if (slide.template && slide.schemaVersion !== 2)
    context.addIssue({ code: "custom", path: ["schemaVersion"], message: "Structured templates require slide schema version 2." });
  if (slide.template && slide.objects.length)
    context.addIssue({ code: "custom", path: ["objects"], message: "Use a separate canvas slide for manually placed objects to preserve the responsive template layout." });
  const ids = new Set<string>();
  slide.objects.forEach((object, index) => {
    if (ids.has(object.id))
      context.addIssue({ code: "custom", path: ["objects", index, "id"], message: "Object identifiers must be unique on a slide." });
    ids.add(object.id);
    if ((object.type === "image" || object.type === "video") && object.states.some((state) => state.content !== undefined && !mediaSourceSchema.safeParse(state.content).success))
      context.addIssue({ code: "custom", path: ["objects", index, "states"], message: "Media object states must use an app path or HTTP(S) URL." });
  });
  const objectIds = new Set(slide.objects.map((object) => object.id));
  slide.objects.forEach((object, index) => {
    object.actions.forEach((action, actionIndex) => {
      if ((action.type === "showObject" || action.type === "hideObject" || action.type === "setState") && !objectIds.has(action.targetObjectId))
        context.addIssue({ code: "custom", path: ["objects", index, "actions", actionIndex, "targetObjectId"], message: "Choose an object on this slide." });
      if (action.type === "setState") {
        const target = slide.objects.find((candidate) => candidate.id === action.targetObjectId);
        if (target && !target.states.some((state) => state.id === action.stateId))
          context.addIssue({ code: "custom", path: ["objects", index, "actions", actionIndex, "stateId"], message: "Choose a state that exists on the target object." });
      }
    });
  });
  slide.interactions.forEach(({ action }, index) => {
    if ((action.type === "showObject" || action.type === "hideObject" || action.type === "setState") && !objectIds.has(action.targetObjectId))
      context.addIssue({ code: "custom", path: ["interactions", index, "action", "targetObjectId"], message: "Choose an object on this slide." });
    if (action.type === "setState") {
      const target = slide.objects.find((candidate) => candidate.id === action.targetObjectId);
      if (target && !target.states.some((state) => state.id === action.stateId))
        context.addIssue({ code: "custom", path: ["interactions", index, "action", "stateId"], message: "Choose a state that exists on the target object." });
    }
  });
});

export const createSlideSchema = z.object({ title: z.string().trim().min(1).max(160).optional(), templateId: z.enum(slideTemplateIds).nullable().default("title-description") }).strict();
export const reorderSlidesSchema = z.object({ slideIds: z.array(z.string().min(1).max(64)).min(1).max(500) }).strict();
export const slideRecordSchema = slideSnapshotSchema.safeExtend({ id: z.string().min(1).max(64) });

export type SlideObject = z.infer<typeof slideObjectSchema>;
export type SlideSnapshot = z.infer<typeof slideSnapshotSchema>;
export type SlideRecord = SlideSnapshot & { id: string };
export type SlideLayout = z.infer<typeof slideLayoutSchema>;
export type SlideAction = z.infer<typeof slideActionSchema>;
export type SlideObjectState = z.infer<typeof slideObjectStateSchema>;
