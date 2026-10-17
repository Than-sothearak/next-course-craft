import { z } from "zod";
import { quizQuestionsSchema } from "@/lib/schemas/quiz";
import { slideMediaSourceSchema } from "./media-source";
import { slideTemplateContentSchema } from "./template-schema";
import { masterOverridesSchema, slideNumberOverrideSchema } from "./master-schema";

export const learningBlockKinds = ["text", "accordion", "tabs", "flashcards", "quiz", "image", "audio", "video", "shape", "button"] as const;
export type LearningBlockKind = typeof learningBlockKinds[number];
const color = z.string().regex(/^#[\da-fA-F]{6}$/);
export const objectPlacementSchema = z.object({
  x: z.number().finite().min(0).max(1280), y: z.number().finite().min(0).max(720),
  width: z.number().finite().min(24).max(1280), height: z.number().finite().min(24).max(720),
  rotation: z.number().finite().min(-180).max(180).default(0), zIndex: z.number().int().min(0).max(500).default(1),
}).strict().superRefine((placement, context) => {
  if (placement.x + placement.width > 1280) context.addIssue({ code: "custom", path: ["width"], message: "Object must fit inside the canvas width." });
  if (placement.y + placement.height > 720) context.addIssue({ code: "custom", path: ["height"], message: "Object must fit inside the canvas height." });
});
export const objectAppearanceSchema = z.object({
  color: color.optional(), backgroundColor: color.optional(), borderColor: color.optional(),
  borderWidth: z.number().int().min(0).max(24).optional(), radius: z.number().int().min(0).max(80).optional(),
  opacity: z.number().min(0).max(1).optional(), fontSize: z.number().min(8).max(160).optional(),
  headingSize: z.number().min(8).max(160).optional(), fontFamily: z.enum(["sans", "serif", "rounded"]).optional(),
  bold: z.boolean().optional(), italic: z.boolean().optional(), textAlign: z.enum(["left", "center", "right"]).optional(),
  imageFit: z.enum(["contain", "cover"]).optional(),
}).strict();
export type ObjectPlacement = z.infer<typeof objectPlacementSchema>;
const items = z.array(z.object({ id: z.string().min(1).max(64), title: z.string().max(160), body: z.string().max(5_000) }).strict()).min(1).max(20).refine((values) => new Set(values.map((item) => item.id)).size === values.length, "Item identifiers must be unique.");
const base = {
  id: z.string().min(1).max(64), name: z.string().trim().min(1).max(160),
  start: z.number().finite().min(0).max(3_600).default(0),
  end: z.number().finite().min(0).max(3_600).nullable().default(null),
  visible: z.boolean().default(true), locked: z.boolean().default(false),
  required: z.boolean().default(false),
  placement: objectPlacementSchema.optional(), appearance: objectAppearanceSchema.optional(),
};
const media = {
  src: slideMediaSourceSchema, transcript: z.string().max(20_000).default(""),
  trimStart: z.number().finite().min(0).max(86_400).default(0),
  trimEnd: z.number().finite().min(0).max(86_400).nullable().default(null),
  volume: z.number().min(0).max(1).default(1), loop: z.boolean().default(false),
  sourceDuration: z.number().finite().positive().max(86_400).optional(),
};
export const learningBlockSchema = z.discriminatedUnion("kind", [
  z.object({ ...base, kind: z.literal("text"), heading: z.string().max(500), body: z.string().max(20_000) }).strict(),
  z.object({ ...base, kind: z.literal("accordion"), items }).strict(),
  z.object({ ...base, kind: z.literal("tabs"), items }).strict(),
  z.object({ ...base, kind: z.literal("flashcards"), items }).strict(),
  z.object({ ...base, kind: z.literal("image"), src: slideMediaSourceSchema, alt: z.string().max(500).default("") }).strict(),
  z.object({ ...base, kind: z.literal("audio"), ...media }).strict(),
  z.object({ ...base, kind: z.literal("video"), ...media }).strict(),
  z.object({ ...base, kind: z.literal("template"), content: slideTemplateContentSchema }).strict(),
  z.object({ ...base, kind: z.literal("shape"), shape: z.enum(["rectangle", "roundedRectangle", "ellipse", "triangle", "line", "arrow"]) }).strict(),
  z.object({ ...base, kind: z.literal("button"), label: z.string().max(160), action: z.enum(["nextSlide", "previousSlide"]) }).strict(),
  z.object({ ...base, kind: z.literal("quiz"), questions: quizQuestionsSchema.refine((questions) => questions.length > 0 && questions.every((question) => question.correctChoiceIds.length > 0), "A quiz needs questions with correct answers."), passingScore: z.number().int().min(0).max(100).default(70) }).strict(),
]).superRefine((block, context) => {
  if (block.end !== null && block.end <= block.start) context.addIssue({ code: "custom", path: ["end"], message: "Layer end must be after its start." });
  if (block.required && !block.visible) context.addIssue({ code: "custom", path: ["required"], message: "A hidden block cannot be required." });
  if (block.required && ["text", "image", "template", "shape", "button"].includes(block.kind)) context.addIssue({ code: "custom", path: ["required"], message: "Reading content is completed with the page completion control." });
  if (block.kind === "audio" || block.kind === "video") {
    if (block.trimEnd !== null && block.trimEnd <= block.trimStart) context.addIssue({ code: "custom", path: ["trimEnd"], message: "Media trim end must be after its start." });
    if (block.required && (block.loop || !block.src)) context.addIssue({ code: "custom", path: ["required"], message: "Required media needs a source and must not loop." });
    if (block.sourceDuration !== undefined && (block.trimStart >= block.sourceDuration || (block.trimEnd !== null && block.trimEnd > block.sourceDuration))) context.addIssue({ code: "custom", path: ["trimEnd"], message: "Trim markers must fit within the media duration." });
  }
  if (block.kind === "quiz") block.questions.forEach((question, index) => {
    if (question.imageSrc && !slideMediaSourceSchema.safeParse(question.imageSrc).success) context.addIssue({ code: "custom", path: ["questions", index, "imageSrc"], message: "Use a safe media source." });
    question.choices.forEach((choice, choiceIndex) => {
      if (choice.imageSrc && !slideMediaSourceSchema.safeParse(choice.imageSrc).success) context.addIssue({ code: "custom", path: ["questions", index, "choices", choiceIndex, "imageSrc"], message: "Use a safe media source." });
    });
  });
});
export const learningPageSchema = z.object({
  duration: z.number().finite().min(1).max(3_600).default(30),
  resolution: z.enum(["hd", "fullHd"]).optional(),
  layout: z.enum(["canvas", "flow"]).optional(),
  masterOverrides: masterOverridesSchema.optional(), numbering: slideNumberOverrideSchema.optional(),
  layers: z.array(learningBlockSchema).max(100),
}).strict().superRefine((page, context) => {
  if (new Set(page.layers.map((layer) => layer.id)).size !== page.layers.length) context.addIssue({ code: "custom", path: ["layers"], message: "Layer identifiers must be unique." });
  page.layers.forEach((layer, index) => {
    if (layer.start >= page.duration || (layer.end !== null && layer.end > page.duration)) context.addIssue({ code: "custom", path: ["layers", index, "start"], message: "Layer timing must fit within the page duration." });
  });
});
export type LearningBlock = z.infer<typeof learningBlockSchema>;
export type LearningPage = z.infer<typeof learningPageSchema>;

export function createLearningBlock(kind: LearningBlockKind): LearningBlock {
  const common = { id: crypto.randomUUID(), name: kind === "text" ? "Reading content" : kind[0].toUpperCase() + kind.slice(1), kind };
  if (kind === "text") return learningBlockSchema.parse({ ...common, heading: "A new idea", body: "Add your learning content here." });
  if (kind === "image") return learningBlockSchema.parse({ ...common, src: "", alt: "" });
  if (kind === "audio" || kind === "video") return learningBlockSchema.parse({ ...common, src: "" });
  if (kind === "shape") return learningBlockSchema.parse({ ...common, shape: "roundedRectangle" });
  if (kind === "button") return learningBlockSchema.parse({ ...common, label: "Continue", action: "nextSlide" });
  if (kind === "quiz") return learningBlockSchema.parse({ ...common, required: true, questions: [{ id: crypto.randomUUID(), prompt: "Which answer is correct?", choices: [{ id: "a", text: "Correct answer" }, { id: "b", text: "Another answer" }], correctChoiceIds: ["a"], correctFeedback: "Correct!", incorrectFeedback: "Review the content and try again." }] });
  return learningBlockSchema.parse({ ...common, required: true, items: [1, 2, 3].map((index) => ({ id: crypto.randomUUID(), title: `Explore ${index}`, body: `Replace this with the explanation for item ${index}.` })) });
}
export function layerActive(layer: LearningBlock, time: number, duration: number) {
  return layer.visible && time >= layer.start && time < (layer.end ?? duration);
}
export function pageRequirementsMet(page: LearningPage, completed: readonly string[]) {
  const ids = new Set(completed);
  return page.layers.filter((layer) => layer.visible && layer.required).every((layer) => ids.has(layer.id));
}
