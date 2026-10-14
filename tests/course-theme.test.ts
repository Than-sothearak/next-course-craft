import { describe, expect, it } from "vitest";
import {
  courseThemeSchema,
  createCourseThemePreset,
  defaultCourseTheme,
  normalizeCourseTheme,
} from "../lib/editor/theme";

describe("course themes", () => {
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

  it("rejects unsafe colors and unknown theme fields", () => {
    expect(courseThemeSchema.safeParse({ ...defaultCourseTheme, primaryColor: "url(javascript:alert(1))" }).success).toBe(false);
    expect(courseThemeSchema.safeParse({ ...defaultCourseTheme, untrustedStyle: "color:red" }).success).toBe(false);
    expect(normalizeCourseTheme({ primaryColor: "red" })).toEqual(defaultCourseTheme);
  });
});
