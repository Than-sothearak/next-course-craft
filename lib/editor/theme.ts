import { z } from "zod";
import { courseCoverSchema } from "./course-cover";

export const courseThemePresetIds = [
  "ocean",
  "forest",
  "sunset",
  "violet",
  "slate",
  "custom",
] as const;

const themeColorSchema = z.string().regex(/^#[\da-fA-F]{6}$/).transform((value) => value.toLowerCase());

export const courseThemeSchema = z.object({
  preset: z.enum(courseThemePresetIds).default("ocean"),
  primaryColor: themeColorSchema.default("#2f5f9f"),
  accentColor: themeColorSchema.default("#ff876c"),
  fontFamily: z.enum(["sans", "serif", "rounded"]).default("sans"),
  cover: courseCoverSchema.optional(),
}).strict();

export type CourseTheme = z.infer<typeof courseThemeSchema>;

export const defaultCourseTheme: CourseTheme = {
  preset: "ocean",
  primaryColor: "#2f5f9f",
  accentColor: "#ff876c",
  fontFamily: "sans",
};

export const courseThemePresets = [
  { id: "ocean", label: "Ocean", primaryColor: "#2f5f9f", accentColor: "#ff876c" },
  { id: "forest", label: "Forest", primaryColor: "#24734f", accentColor: "#f2a65a" },
  { id: "sunset", label: "Sunset", primaryColor: "#bd4e3b", accentColor: "#f2a65a" },
  { id: "violet", label: "Violet", primaryColor: "#6941c6", accentColor: "#ef74a8" },
  { id: "slate", label: "Slate", primaryColor: "#475569", accentColor: "#14b8a6" },
] as const;

export function createCourseThemePreset(preset: (typeof courseThemePresets)[number]["id"]): CourseTheme {
  const option = courseThemePresets.find((item) => item.id === preset);
  if (!option) return { ...defaultCourseTheme };
  return courseThemeSchema.parse({
    preset: option.id,
    primaryColor: option.primaryColor,
    accentColor: option.accentColor,
    fontFamily: "sans",
  });
}

export function normalizeCourseTheme(theme: unknown): CourseTheme {
  const parsed = courseThemeSchema.safeParse(theme ?? {});
  return parsed.success ? parsed.data : { ...defaultCourseTheme };
}

export const courseThemeFontFamilies: Record<CourseTheme["fontFamily"], string> = {
  sans: "Arial, Helvetica, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  rounded: "'Trebuchet MS', Arial, sans-serif",
};
