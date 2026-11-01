import { z } from "zod";

const color = z.string().regex(/^#[\da-f]{6}$/i);
export const peelDirections = ["top-right", "top-left", "bottom-right", "bottom-left"] as const;
export const peelContentTypes = ["richText", "heading", "statement", "image", "gallery", "video", "audio", "link"] as const;
export const physicsPresets = {
  soft: { dragResistance: 0.18, springStiffness: 110, damping: 19 },
  realistic: { dragResistance: 0.32, springStiffness: 180, damping: 24 },
  arcade: { dragResistance: 0.08, springStiffness: 260, damping: 15 },
} as const;

export const peelSettingsSchema = z.object({
  title: z.string().max(160).default("A little discovery"),
  instructions: z.string().max(500).default("Grab the corner and peel, or tap to discover what's underneath."),
  paperColor: color.default("#fff8e8"),
  backgroundColor: color.default("#ffffff"),
  accentColor: color.default("#4338ca"),
  material: z.enum(["paper", "linen", "smooth"]).default("paper"),
  cornerRadius: z.number().min(0).max(64).default(24),
  thickness: z.number().min(0).max(8).default(2),
  shadowIntensity: z.number().min(0).max(100).default(40),
  direction: z.enum(peelDirections).default("top-right"),
  indicator: z.enum(["grip", "arrow", "none"]).default("grip"),
  cardWidth: z.number().int().min(240).max(1200).default(680),
  cardHeight: z.number().int().min(200).max(1000).default(360),
  physicsPreset: z.enum(["soft", "realistic", "arcade"]).default("realistic"),
  dragResistance: z.number().min(0).max(0.85).default(0.32),
  springStiffness: z.number().min(40).max(500).default(180),
  damping: z.number().min(4).max(60).default(24),
  peelThreshold: z.number().min(0.2).max(0.95).default(0.55),
  animationDuration: z.number().int().min(200).max(4000).default(1000),
  autoComplete: z.boolean().default(true),
  allowReset: z.boolean().default(true),
  allowRepeat: z.boolean().default(true),
  trigger: z.enum(["drag", "click", "both"]).default("both"),
  showInstructions: z.boolean().default(true),
});
export type PeelSettings = z.infer<typeof peelSettingsSchema>;
