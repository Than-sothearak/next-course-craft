import { z } from "zod";
import { institutionalGreenMaster, slideMasterSchema } from "./master-schema";

export const slideThemeIds = ["minimal", "corporate", "education", "creative", "dark", "white", "institutional-green"] as const;
export const slideColorSchema = z.string().regex(/^#[\da-fA-F]{6}$/).transform((value) => value.toLowerCase());
export const slideThemeSchema = z.object({
  preset: z.enum([...slideThemeIds, "custom"]).default("minimal"),
  primaryColor: slideColorSchema.default("#5546d9"),
  secondaryColor: slideColorSchema.default("#243052"),
  accentColor: slideColorSchema.default("#c45d32"),
  backgroundColor: slideColorSchema.default("#faf9f6"),
  fontFamily: z.enum(["sans", "serif", "rounded"]).default("sans"),
  headingScale: z.number().min(0.8).max(1.25).default(1),
  bodyScale: z.number().min(0.9).max(1.2).default(1),
  radius: z.number().int().min(0).max(32).default(20),
  density: z.enum(["compact", "comfortable", "spacious"]).default("comfortable"),
  buttonStyle: z.enum(["solid", "outline"]).default("solid"),
  cardStyle: z.enum(["flat", "outline", "elevated"]).default("flat"),
  master: slideMasterSchema.optional(),
}).strict();
export const slideThemeOverridesSchema = z.object({
  primaryColor: slideColorSchema.optional(), secondaryColor: slideColorSchema.optional(),
  accentColor: slideColorSchema.optional(), backgroundColor: slideColorSchema.optional(),
  fontFamily: z.enum(["sans", "serif", "rounded"]).optional(),
  headingScale: z.number().min(0.8).max(1.25).optional(), bodyScale: z.number().min(0.9).max(1.2).optional(),
  radius: z.number().int().min(0).max(32).optional(), density: z.enum(["compact", "comfortable", "spacious"]).optional(),
  buttonStyle: z.enum(["solid", "outline"]).optional(), cardStyle: z.enum(["flat", "outline", "elevated"]).optional(),
}).strict();
export type SlideTheme = z.infer<typeof slideThemeSchema>;
export type SlideThemeOverrides = z.infer<typeof slideThemeOverridesSchema>;
export const defaultSlideTheme = slideThemeSchema.parse({});
export const slideThemePresets: Array<{ id: typeof slideThemeIds[number]; label: string; description: string; theme: SlideTheme }> = [
  { id: "institutional-green", label: "Institutional Green", description: "Angled green header, institution logo and numbered module footer", theme: slideThemeSchema.parse({ preset: "institutional-green", primaryColor: "#199b5b", secondaryColor: "#185c38", accentColor: "#b4ca5f", backgroundColor: "#f2fff3", fontFamily: "serif", master: institutionalGreenMaster }) },
  { id: "minimal", label: "Modern Minimal", description: "Warm paper, quiet violet, generous space", theme: defaultSlideTheme },
  { id: "corporate", label: "Corporate Professional", description: "Confident navy with restrained gold", theme: slideThemeSchema.parse({ preset: "corporate", primaryColor: "#18354d", secondaryColor: "#33576c", accentColor: "#956512", backgroundColor: "#f5f7fa", radius: 8, cardStyle: "outline" }) },
  { id: "education", label: "Education Blue", description: "Welcoming blue with a fresh teal accent", theme: slideThemeSchema.parse({ preset: "education", primaryColor: "#1c5aa6", secondaryColor: "#134f60", accentColor: "#097969", backgroundColor: "#f1f7fc", fontFamily: "rounded", radius: 24 }) },
  { id: "creative", label: "Creative Gradient", description: "Expressive plum and soft coral", theme: slideThemeSchema.parse({ preset: "creative", primaryColor: "#7039a7", secondaryColor: "#48315a", accentColor: "#bc4c2f", backgroundColor: "#fff6f2", radius: 28, cardStyle: "elevated" }) },
  { id: "dark", label: "Dark Presentation", description: "An immersive charcoal canvas", theme: slideThemeSchema.parse({ preset: "dark", primaryColor: "#b4a5ff", secondaryColor: "#b9c9e5", accentColor: "#ffbc8a", backgroundColor: "#121b2a", radius: 16, cardStyle: "outline" }) },
  { id: "white", label: "Clean White", description: "Crisp white and editorial green", theme: slideThemeSchema.parse({ preset: "white", primaryColor: "#245b50", secondaryColor: "#334943", accentColor: "#a04f32", backgroundColor: "#ffffff", fontFamily: "serif", radius: 4, cardStyle: "outline" }) },
];
export function normalizeSlideTheme(value: unknown): SlideTheme {
  const result = slideThemeSchema.safeParse(value ?? {});
  return result.success ? result.data : { ...defaultSlideTheme };
}
export function slideLuminance(hex: string) {
  const channels = hex.slice(1).match(/../g)!.map((part) => parseInt(part, 16) / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
export function slideContrast(first: string, second: string) {
  const a = slideLuminance(first), b = slideLuminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
export function readableSlideColor(background: string) {
  const preferred = slideContrast(background, "#ffffff") >= slideContrast(background, "#172033") ? "#ffffff" : "#172033";
  return slideContrast(background, preferred) >= 4.5 ? preferred : "#000000";
}
export function mixSlideColors(first: string, second: string, weight: number) {
  return "#" + [1, 3, 5].map((index) => Math.round(parseInt(first.slice(index, index + 2), 16) * weight + parseInt(second.slice(index, index + 2), 16) * (1 - weight)).toString(16).padStart(2, "0")).join("");
}
export const slideThemeUpdateSchema = z.object({ theme: slideThemeSchema, revision: z.number().int().min(0) }).strict();
export type SlideThemeSnapshot = z.infer<typeof slideThemeUpdateSchema>;
