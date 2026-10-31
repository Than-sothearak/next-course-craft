import { z } from "zod";
import { colorValueSchema } from "@/lib/color";
import { croppedDimensions, type SlideCrop } from "./slide-crop";
import { slideNavigationButtonsSchema } from "./slide-navigation-design";

export const slideFrameSchema = z.object({
  x: z.number().min(0).max(95),
  y: z.number().min(0).max(95),
  width: z.number().min(5).max(100),
  height: z.number().min(5).max(100),
  z: z.number().int().min(0).max(500),
}).refine((frame) => frame.x + frame.width <= 100 && frame.y + frame.height <= 100, "Slide objects must stay on the canvas.");
export type SlideFrame = z.infer<typeof slideFrameSchema>;
export const slideBorderRadiusSchema = z.number().min(0).max(100);
export const defaultSlideBorderRadius = 12;

export const slideSizeSchema = z.object({
  width: z.number().int().min(480).max(3840),
  height: z.number().int().min(480).max(3840),
});
export type SlideSize = z.infer<typeof slideSizeSchema>;
export const defaultSlideSize: SlideSize = { width: 960, height: 540 };
export const slideSizePresets = [
  { id: "widescreen", label: "Widescreen (16:9)", width: 960, height: 540 },
  { id: "standard", label: "Standard (4:3)", width: 960, height: 720 },
  { id: "square", label: "Square (1:1)", width: 720, height: 720 },
] as const;

export function resolveSlideSize(master?: { size?: SlideSize }): SlideSize {
  return master?.size ?? defaultSlideSize;
}

// The object region below the title and above the footer in SlideSurface.
export function resolveSlideFooterHeight(master?: { footer?: { height?: number } }): number { return master?.footer?.height ?? 64; }

export function resolveSlideObjectArea(master?: { size?: SlideSize; footer?: { height?: number } }): SlideSize {
  const size = resolveSlideSize(master);
  return { width: size.width, height: size.height - 108 - resolveSlideFooterHeight(master) };
}
export function resolveSlideCoverObjectArea(master?: { size?: SlideSize; footer?: { height?: number } }): SlideSize {
  const size = resolveSlideSize(master);
  return { width: size.width, height: size.height - resolveSlideFooterHeight(master) };
}
export const slideObjectArea = resolveSlideObjectArea();

export const slidePlaybackSchema = z.object({
  autoPlay: z.boolean().default(false),
  showControls: z.boolean().default(true),
  showFileName: z.boolean().optional(),
});

export const slideTextLayoutSchema = z.object({
  horizontal: z.enum(["left", "center", "right", "justify"]).optional(),
  vertical: z.enum(["top", "middle", "bottom"]).default("top"),
});
export type SlideTextLayout = z.infer<typeof slideTextLayoutSchema>;

export const slideMediaSchema = z.object({
  source: z.string().min(1),
  width: z.number().int().positive().max(100_000),
  height: z.number().int().positive().max(100_000),
});
export type SlideMedia = z.infer<typeof slideMediaSchema>;

export function fitSlideFrame(frame: SlideFrame, update: Partial<SlideFrame>): SlideFrame {
  let width = Math.max(5, Math.min(100, update.width ?? frame.width));
  let height = Math.max(5, Math.min(100, update.height ?? frame.height));
  let x = Math.max(0, Math.min(95, update.x ?? frame.x));
  let y = Math.max(0, Math.min(95, update.y ?? frame.y));
  if (update.width !== undefined && update.x === undefined) width = Math.min(width, 100 - x);
  else x = Math.min(x, 100 - width);
  if (update.height !== undefined && update.y === undefined) height = Math.min(height, 100 - y);
  else y = Math.min(y, 100 - height);
  return { x, y, width, height, z: Math.max(0, Math.min(500, Math.round(update.z ?? frame.z))) };
}

/** Size in the object's percentage coordinate system, accounting for its rectangular canvas. */
export function fitSlideMediaFrame(frame: SlideFrame, media: Pick<SlideMedia, "width" | "height">, size: { width?: number; height?: number }, area: SlideSize = slideObjectArea): SlideFrame {
  if (!Number.isFinite(media.width) || !Number.isFinite(media.height) || media.width <= 0 || media.height <= 0) return frame;
  // Extreme panoramic media still uses object-contain inside the smallest valid frame.
  const ratio = Math.max(0.05, Math.min(20, (media.width / media.height) / (area.width / area.height)));
  const minimumWidth = Math.max(5, 5 * ratio);
  const maximumWidth = Math.max(minimumWidth, Math.min(100 - frame.x, (100 - frame.y) * ratio));
  const requestedWidth = size.width ?? (size.height === undefined ? frame.width : size.height * ratio);
  const width = Math.min(maximumWidth, Math.max(minimumWidth, requestedWidth));
  const height = width / ratio;
  return { ...frame, x: Math.min(frame.x, 100 - width), y: Math.min(frame.y, 100 - height), width, height };
}

export const slideBackgroundSchema = z.object({
  color: colorValueSchema,
  opacity: z.number().int().min(0).max(100),
});
export type SlideBackground = z.infer<typeof slideBackgroundSchema>;

export function resolveSlideBackground(block: { backgroundColor: string; slideBackground?: SlideBackground }): SlideBackground {
  return block.slideBackground ?? { color: block.backgroundColor, opacity: 0 };
}

export const slideImageSourceSchema = z.string().refine((value) => value === "" ||
  /^\/api\/assets\/[a-f\d]{24}\/file$/i.test(value) ||
  /^\.\/media\/[a-z\d.-]+$/i.test(value) ||
  /^data:image\/(?:png|jpeg|webp|avif|gif);base64,[a-z\d+/=\s]+$/i.test(value), "Choose an image from the media library.");

export const slideAbstractDesigns = [
  { id: "waves", name: "Waves" }, { id: "orbits", name: "Orbits" },
  { id: "prism", name: "Prism" }, { id: "ribbons", name: "Ribbons" },
  { id: "dots", name: "Dots" }, { id: "glow", name: "Glow" },
] as const;
export const slideMasterBackgroundSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("solid") }),
  z.object({ type: z.literal("abstract"), design: z.enum(["waves", "orbits", "prism", "ribbons", "dots", "glow"]) }),
  z.object({ type: z.literal("image"), imageSrc: slideImageSourceSchema.default(""), imagePosition: z.enum(["center", "top", "bottom"]).default("center"), overlayOpacity: z.number().int().min(0).max(90).default(30) }),
]);

export const slideFooterSchema = z.object({
  height: z.number().int().min(48).max(160).default(64),
  fontSize: z.number().int().min(10).max(24).default(12),
  contentGap: z.number().int().min(0).max(32).default(16),
  content: z.enum(["text", "logos", "both"]).default("text"),
  logos: z.array(z.object({
    id: z.string().min(1).max(64),
    src: slideImageSourceSchema.refine((value) => value.length > 0, "Choose a logo from the media library."),
    alt: z.string().max(160).default(""),
  })).max(12).default([]).refine((logos) => new Set(logos.map((logo) => logo.id)).size === logos.length, "Footer logos must have unique IDs."),
  paddingX: z.number().int().min(0).max(64).default(20),
  paddingY: z.number().int().min(0).max(32).default(8),
  logoGapX: z.number().int().min(0).max(32).default(8),
  logoGapY: z.number().int().min(0).max(12).default(4),
  logoJustify: z.enum(["left", "center", "right", "between"]).default("center"),
  logoAlign: z.enum(["top", "middle", "bottom"]).default("middle"),
  backgroundColor: colorValueSchema.default("#ffffff"),
  textColor: colorValueSchema.default("#172033"),
  borderTop: z.boolean().default(true),
  borderColor: colorValueSchema.default("#cbd5e1"),
  borderWidth: z.number().int().min(1).max(6).default(1),
});
export type SlideFooter = z.infer<typeof slideFooterSchema>;

export const slideHeaderSchema = z.object({
  background: z.enum(["transparent", "color", "image"]).default("transparent"),
  backgroundColor: colorValueSchema.default("#ffffff"),
  textColor: colorValueSchema.optional(),
  imageSrc: slideImageSourceSchema.default(""),
  imagePosition: z.enum(["center", "top", "bottom"]).default("center"),
  overlayOpacity: z.number().int().min(0).max(90).default(20),
});
export type SlideHeader = z.infer<typeof slideHeaderSchema>;

export const slideNavigationGuideSchema = z.object({
  enabled: z.boolean().default(false),
  firstVisitOnly: z.boolean().default(true),
  nextText: z.string().trim().min(1).max(300).default("Click Next to continue to the next slide. Complete any required activities first."),
  previousText: z.string().trim().min(1).max(300).default("Use Previous to return to a slide you have already opened."),
  restartText: z.string().trim().min(1).max(300).default("Restart replays this slide's video and audio without clearing your progress."),
});
export type SlideNavigationGuide = z.infer<typeof slideNavigationGuideSchema>;

export const slideMasterSchema = z.object({
  size: slideSizeSchema.optional(),
  template: z.enum(["paper", "midnight", "gradient", "warm"]).default("paper"),
  backgroundColor: colorValueSchema.default("#ffffff"),
  textColor: colorValueSchema.default("#172033"),
  accentColor: colorValueSchema.default("#4f46e5"),
  footerText: z.string().max(120).default(""),
  showSlideNumber: z.boolean().default(true),
  background: slideMasterBackgroundSchema.optional(),
  footer: slideFooterSchema.optional(),
  header: slideHeaderSchema.optional(),
  navigationGuide: slideNavigationGuideSchema.optional(),
  navigationButtons: slideNavigationButtonsSchema.optional(),
});
export type SlideMaster = z.infer<typeof slideMasterSchema>;
export const defaultSlideMaster: SlideMaster = slideMasterSchema.parse({});

export function resolveSlideHeader(master: SlideMaster): SlideHeader {
  return master.header ?? slideHeaderSchema.parse({ backgroundColor: master.backgroundColor });
}

export function resolveSlideFooter(master: SlideMaster): SlideFooter {
  return master.footer ?? slideFooterSchema.parse({ backgroundColor: master.backgroundColor, textColor: master.textColor, borderColor: master.accentColor });
}

export const slideCoverPositions = ["top-left", "top-center", "top-right", "middle-left", "middle-center", "middle-right", "bottom-left", "bottom-center", "bottom-right"] as const;
export const slideCoverPositionSchema = z.enum(slideCoverPositions);
export const slideCoverElementLayoutSchema = z.object({
  position: slideCoverPositionSchema,
  offsetX: z.number().min(-3840).max(3840).default(0),
  offsetY: z.number().min(-3840).max(3840).default(0),
});
export type SlideCoverElementLayout = z.infer<typeof slideCoverElementLayoutSchema>;

export const slideAudioSourceSchema = z.string().refine((value) => value === "" ||
  /^\/api\/assets\/[a-f\d]{24}\/file$/i.test(value) ||
  /^\.\/media\/[a-z\d.-]+$/i.test(value) ||
  /^data:audio\/(?:mpeg|mp3|mp4|ogg|wav|x-wav|webm);base64,[a-z\d+/=\s]+$/i.test(value), "Choose audio from the media library.");

export const slideCoverInstructionsSchema = z.object({
  audioSrc: slideAudioSourceSchema.default(""),
  audioName: z.string().max(255).default(""),
  audioTrigger: z.enum(["manual", "cover", "start"]).default("manual"),
  noticeEnabled: z.boolean().default(false),
  noticeTitle: z.string().trim().min(1).max(120).default("Welcome to this course"),
  noticeText: z.string().max(1000).default("Click Start to begin. Use Next and Previous to move between slides."),
  noticeTrigger: z.enum(["cover", "start"]).default("cover"),
  firstVisitOnly: z.boolean().default(true),
});
export type SlideCoverInstructions = z.infer<typeof slideCoverInstructionsSchema>;

export const slideCoverSchema = z.object({
  template: z.literal("imageCover"),
  imageSrc: slideImageSourceSchema.default(""),
  imageAlt: z.string().max(500).default(""),
  subtitle: z.string().max(300).default(""),
  lessonOf: z.string().max(160).default(""),
  startLabel: z.string().trim().min(1).max(60).default("Start"),
  overlayOpacity: z.number().int().min(0).max(90).default(50),
  contentPosition: slideCoverPositionSchema.optional(),
  titleLayout: slideCoverElementLayoutSchema.optional(),
  subtitleLayout: slideCoverElementLayoutSchema.optional(),
  buttonLayout: slideCoverElementLayoutSchema.optional(),
  instructions: slideCoverInstructionsSchema.optional(),
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
  if (type === "audioInstruction") return { x: 35, y: Math.min(80 + index * 2, 86), width: 30, height: 12, z: index };
  if (type === "interactionButton") return { x: 44, y: Math.min(12 + index * 4, 70), width: 12, height: 28, z: index };
  const interactive = ["flipCard", "accordion", "labeledGraphic", "processSteps", "knowledgeCheck", "survey", "chart", "lessonMap"].includes(type);
  const media = ["image", "gallery", "video", "audio"].includes(type);
  const width = interactive ? 82 : media ? 58 : 78;
  const height = interactive ? 80 : media ? 82 : type === "heading" ? 24 : 55;
  return { x: (100 - width) / 2, y: Math.min(8 + index * 5, 100 - height), width, height, z: index };
}

/** Place older slide blocks without saved frames into nonoverlapping cells. */
export function resolveSlideFrame(block: { slideFrame?: SlideFrame; slideMedia?: SlideMedia; slideCrop?: SlideCrop; type: string; data?: unknown }, index: number, total: number, area: SlideSize = slideObjectArea): SlideFrame {
  if (block.slideFrame) {
    const data = block.data && typeof block.data === "object" ? block.data : null;
    const source = data && "src" in data ? data.src : undefined;
    const layout = data && "layout" in data ? data.layout : undefined;
    const media = block.type === "video" || (block.type === "image" && (!layout || layout === "full"));
    // Refit source-scoped dimensions when the available object region changes.
    if (media && block.slideMedia && block.slideMedia.source === source) return fitSlideMediaFrame(block.slideFrame, croppedDimensions(block.slideMedia, block.slideCrop?.source === source ? block.slideCrop : undefined), { width: block.slideFrame.width }, area);
    return block.slideFrame;
  }
  if (total <= 1) return defaultSlideFrame(index, block.type);
  const columns = total <= 4 ? 2 : 3;
  const rows = Math.ceil(total / columns);
  const width = 90 / columns - 2;
  const height = Math.max(5, 88 / rows - 2);
  const column = index % columns;
  const row = Math.floor(index / columns);
  return { x: 5 + column * (90 / columns), y: 6 + row * (88 / rows), width, height, z: index };
}
