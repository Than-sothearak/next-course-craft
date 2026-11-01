import { z } from "zod";

const color = z.string().regex(/^#[\da-f]{6}$/i);
export const ropeCardSettingsSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().max(160).default("A discovery"),
  description: z.string().max(300).default("Pull me to the glowing point"),
  color: color.optional(),
  targetX: z.number().min(35).max(65).default(50),
  targetY: z.number().min(70).max(80).default(79),
});
export const ropePhysicsPresets = {
  soft: { springStiffness: 75, damping: 12, dragResistance: .12 },
  realistic: { springStiffness: 140, damping: 16, dragResistance: .24 },
  arcade: { springStiffness: 230, damping: 9, dragResistance: .08 },
} as const;
export const hangingRopeSettingsSchema = z.object({
  title: z.string().max(160).default("Pull a little. Discover more."),
  instructions: z.string().max(500).default("Grab a card, pull it to its glowing point, and release to discover the content."),
  backgroundColor: color.default("#ffffff"),
  cardColor: color.default("#fff8e8"),
  textColor: color.default("#1c1917"),
  ropeColor: color.default("#8f7b60"),
  accentColor: color.default("#4f46e5"),
  revealMode: z.enum(["flip", "open"]).default("flip"),
  physicsPreset: z.enum(["soft", "realistic", "arcade"]).default("realistic"),
  ropeLength: z.number().min(60).max(125).default(96),
  ropeThickness: z.number().min(1).max(8).default(3),
  springStiffness: z.number().min(40).max(300).default(140),
  damping: z.number().min(4).max(40).default(16),
  dragResistance: z.number().min(0).max(.7).default(.24),
  maxStretch: z.number().min(80).max(260).default(210),
  targetRadius: z.number().min(20).max(52).default(38),
  animationDuration: z.number().int().min(200).max(4000).default(1000),
  allowReplay: z.boolean().default(true),
  showInstructions: z.boolean().default(true),
});
export type HangingRopeSettings = z.infer<typeof hangingRopeSettingsSchema>;
export type RopeCardSettings = z.infer<typeof ropeCardSettingsSchema>;
