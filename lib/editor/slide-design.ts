import { z } from "zod";

export const slideFrameSchema = z.object({
  x: z.number().min(0).max(95),
  y: z.number().min(0).max(95),
  width: z.number().min(5).max(100),
  height: z.number().min(5).max(100),
  z: z.number().int().min(0).max(500),
}).refine((frame) => frame.x + frame.width <= 100 && frame.y + frame.height <= 100, "Slide objects must stay on the canvas.");
export type SlideFrame = z.infer<typeof slideFrameSchema>;

export const slideMasterSchema = z.object({
  template: z.enum(["paper", "midnight", "gradient", "warm"]).default("paper"),
  backgroundColor: z.string().regex(/^#[\da-fA-F]{6}$/).default("#ffffff"),
  textColor: z.string().regex(/^#[\da-fA-F]{6}$/).default("#172033"),
  accentColor: z.string().regex(/^#[\da-fA-F]{6}$/).default("#4f46e5"),
  footerText: z.string().max(120).default(""),
  showSlideNumber: z.boolean().default(true),
});
export type SlideMaster = z.infer<typeof slideMasterSchema>;
export const defaultSlideMaster: SlideMaster = slideMasterSchema.parse({});

export const slideCoverSchema = z.object({
  template: z.literal("imageCover"),
  imageSrc: z.string().refine((value) => value === "" ||
    /^\/api\/assets\/[a-f\d]{24}\/file$/i.test(value) ||
    /^\.\/media\/[a-z\d.-]+$/i.test(value) ||
    /^data:image\/(?:png|jpeg|webp|avif|gif);base64,[a-z\d+/=\s]+$/i.test(value), "Choose an image from the media library.").default(""),
  imageAlt: z.string().max(500).default(""),
  subtitle: z.string().max(300).default(""),
  lessonOf: z.string().max(160).default(""),
  startLabel: z.string().trim().min(1).max(60).default("Start"),
  overlayOpacity: z.number().int().min(0).max(90).default(50),
});
export type SlideCover = z.infer<typeof slideCoverSchema>;
export const defaultSlideCover: SlideCover = slideCoverSchema.parse({ template: "imageCover" });

export const slideMasterPresets: { id: SlideMaster["template"]; name: string; backgroundColor: string; textColor: string; accentColor: string }[] = [
  { id: "paper", name: "Paper", backgroundColor: "#ffffff", textColor: "#172033", accentColor: "#4f46e5" },
  { id: "midnight", name: "Midnight", backgroundColor: "#0f172a", textColor: "#f8fafc", accentColor: "#a5b4fc" },
  { id: "gradient", name: "Indigo glow", backgroundColor: "#eef2ff", textColor: "#1e1b4b", accentColor: "#6366f1" },
  { id: "warm", name: "Warm", backgroundColor: "#fff7ed", textColor: "#431407", accentColor: "#ea580c" },
];

export function defaultSlideFrame(index: number, type: string): SlideFrame {
  const interactive = ["flipCard", "accordion", "labeledGraphic", "processSteps", "knowledgeCheck", "survey", "chart", "lessonMap"].includes(type);
  const media = ["image", "gallery", "video", "audio"].includes(type);
  const width = interactive ? 82 : media ? 58 : 78;
  const height = interactive ? 80 : media ? 82 : type === "heading" ? 24 : 55;
  return { x: (100 - width) / 2, y: Math.min(8 + index * 5, 100 - height), width, height, z: index };
}

/** Place older slide blocks without saved frames into nonoverlapping cells. */
export function resolveSlideFrame(block: { slideFrame?: SlideFrame; type: string }, index: number, total: number): SlideFrame {
  if (block.slideFrame) return block.slideFrame;
  if (total <= 1) return defaultSlideFrame(index, block.type);
  const columns = total <= 4 ? 2 : 3;
  const rows = Math.ceil(total / columns);
  const width = 90 / columns - 2;
  const height = Math.max(5, 88 / rows - 2);
  const column = index % columns;
  const row = Math.floor(index / columns);
  return { x: 5 + column * (90 / columns), y: 6 + row * (88 / rows), width, height, z: index };
}
