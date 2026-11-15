import { describe, expect, it } from "vitest";
import { Course } from "../models/Course";
import {
  courseThemeFontFamilies,
  courseThemeFontFamilyIds,
  courseThemeSchema,
  createCourseThemePreset,
  defaultCourseTheme,
  normalizeCourseTheme,
  courseTypographyAttributes,
} from "../lib/editor/theme";

describe("course themes", () => {
  it("validates optional typography overrides and persists them without changing legacy defaults", () => {
    const typography = { titleSize: 44, subtitleSize: 28, headingSize: 22, bodySize: 18, titleAlignment: "right" as const, lineHeight: 1.6 };
    const theme = courseThemeSchema.parse({ ...defaultCourseTheme, typography });
    expect(normalizeCourseTheme(theme).typography).toEqual(typography);
    const course = new Course({ ownerId: "507f1f77bcf86cd799439011", title: "Typography", theme });
    expect(course.validateSync()).toBeUndefined();
    expect(course.toObject().theme?.typography).toEqual(typography);
    expect(courseTypographyAttributes(theme)["data-course-typography"]).toBe("title subtitle heading body alignment leading");
    expect(courseTypographyAttributes(theme).style["--course-body-size"]).toBe("18px");
    expect(courseTypographyAttributes(defaultCourseTheme)).toEqual({ "data-course-typography": undefined, style: {} });
    for (const invalid of [{ titleSize: 97 }, { bodySize: 0 }, { subtitleSize: 13.5 }, { lineHeight: 5 }, { titleAlignment: "justify" }, { css: "url(unsafe)" }]) {
      expect(courseThemeSchema.safeParse({ ...defaultCourseTheme, typography: invalid }).success).toBe(false);
    }
  });
  it("defaults older courses to the ocean theme", () => {
    expect(courseThemeSchema.parse({})).toEqual(defaultCourseTheme);
    expect(normalizeCourseTheme(undefined)).toEqual(defaultCourseTheme);
  });

  it("creates complete preset values and allows local font choices", () => {
    expect(createCourseThemePreset("forest")).toMatchObject({
      preset: "forest",
      primaryColor: "#24734f",
      accentColor: "#f2a65a",
      fontFamily: "sans",
    });
    expect(courseThemeSchema.parse({ ...createCourseThemePreset("violet"), fontFamily: "serif" }).fontFamily).toBe("serif");
  });

  it("supports Khmer fonts and keeps a Khmer fallback in the general theme choices", () => {
    expect(courseThemeFontFamilyIds).toContain("battambang");
    expect(courseThemeFontFamilyIds).toContain("kantumruy-pro");
    expect(courseThemeFontFamilyIds).toContain("nokora");
    for (const fontFamily of courseThemeFontFamilyIds)
      expect(courseThemeSchema.parse({ ...defaultCourseTheme, fontFamily }).fontFamily).toBe(fontFamily);
    expect(courseThemeFontFamilies.sans).toContain("Noto Sans Khmer");
    expect(courseThemeFontFamilies.serif).toContain("Nokora");
  });

  it("allows the Khmer typography choices through the persisted course schema", () => {
    const course = new Course({
      ownerId: "507f1f77bcf86cd799439011",
      title: "Khmer typography",
      theme: { fontFamily: "kantumruy-pro" },
    });

    expect(course.validateSync()).toBeUndefined();
  });

  it("rejects unsafe colors and unknown theme fields", () => {
    expect(courseThemeSchema.safeParse({ ...defaultCourseTheme, primaryColor: "url(javascript:alert(1))" }).success).toBe(false);
    expect(courseThemeSchema.safeParse({ ...defaultCourseTheme, untrustedStyle: "color:red" }).success).toBe(false);
    expect(normalizeCourseTheme({ primaryColor: "red" })).toEqual(defaultCourseTheme);
  });
});
