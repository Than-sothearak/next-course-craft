import { z } from "zod";
import type { CSSProperties } from "react";
import { courseCoverRenderSchema, courseCoverSchema } from "./course-cover";

export const courseThemePresetIds = [
  "ocean",
  "forest",
  "sunset",
  "violet",
  "slate",
  "custom",
] as const;

const themeColorSchema = z.string().regex(/^#[\da-fA-F]{6}$/).transform((value) => value.toLowerCase());
export const courseThemeFontFamilyIds = [
  "sans",
  "serif",
  "rounded",
  "noto-sans-khmer",
  "battambang",
  "kantumruy-pro",
  "nokora",
] as const;

export const courseTypographySchema = z.object({
  titleSize: z.number().int().min(12).max(96).optional(),
  subtitleSize: z.number().int().min(12).max(72).optional(),
  headingSize: z.number().int().min(12).max(64).optional(),
  bodySize: z.number().int().min(10).max(36).optional(),
  titleAlignment: z.enum(["left", "center", "right"]).optional(),
  lineHeight: z.number().min(1).max(2.4).optional(),
}).strict();
export type CourseTypography = z.infer<typeof courseTypographySchema>;

export const courseThemeSchema = z.object({
  preset: z.enum(courseThemePresetIds).default("ocean"),
  primaryColor: themeColorSchema.default("#2f5f9f"),
  accentColor: themeColorSchema.default("#ff876c"),
  fontFamily: z.enum(courseThemeFontFamilyIds).default("sans"),
  typography: courseTypographySchema.optional(),
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

const courseThemeRenderSchema = courseThemeSchema.extend({ cover: courseCoverRenderSchema.optional() });

export function normalizeCourseTheme(theme: unknown): CourseTheme {
  const parsed = courseThemeRenderSchema.safeParse(theme ?? {});
  return parsed.success ? parsed.data : { ...defaultCourseTheme };
}

export const courseThemeFontFamilies: Record<CourseTheme["fontFamily"], string> = {
  sans: "Arial, Helvetica, 'Noto Sans Khmer', sans-serif",
  serif: "Georgia, 'Nokora', 'Noto Sans Khmer', 'Times New Roman', serif",
  rounded: "'Trebuchet MS', 'Noto Sans Khmer', Arial, sans-serif",
  "noto-sans-khmer": "'Noto Sans Khmer', Arial, Helvetica, sans-serif",
  battambang: "Battambang, Arial, Helvetica, sans-serif",
  "kantumruy-pro": "'Kantumruy Pro', Arial, Helvetica, sans-serif",
  nokora: "Nokora, Georgia, serif",
};

/** Missing overrides preserve the existing responsive defaults of each text role. */
export function courseTypographyAttributes(theme: CourseTheme) {
  const typography = theme.typography ?? {};
  const style: CSSProperties & Record<string, string | number> = {};
  const roles: string[] = [];
  for (const role of ["title", "subtitle", "heading", "body"] as const) {
    const size = typography[`${role}Size`];
    if (size !== undefined) { roles.push(role); style[`--course-${role}-size`] = `${size}px`; }
  }
  if (typography.titleAlignment) { roles.push("alignment"); style["--course-title-align"] = typography.titleAlignment; }
  if (typography.lineHeight !== undefined) { roles.push("leading"); style["--course-body-leading"] = typography.lineHeight; }
  return { "data-course-typography": roles.join(" ") || undefined, style };
}
