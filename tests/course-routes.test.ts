import { describe, expect, it } from "vitest";
import {
  courseEditorMode,
  editorModeHref,
  lessonEditorHref,
  previewModeHref,
} from "../lib/editor/course-routes";

describe("course editor mode routes", () => {
  it("maps course layouts to their dedicated editor modes", () => {
    expect(courseEditorMode("standard")).toBe("standard");
    expect(courseEditorMode("slides")).toBe("presentation");
    expect(courseEditorMode(undefined)).toBe("standard");
  });

  it("builds dedicated editor and preview paths", () => {
    expect(editorModeHref("course 1", "standard")).toBe(
      "/courses/course%201/edit/standard-mode",
    );
    expect(editorModeHref("course 1", "presentation")).toBe(
      "/courses/course%201/edit/presentation-mode",
    );
    expect(previewModeHref("course 1", "standard")).toBe(
      "/courses/course%201/preview/standard-mode",
    );
    expect(previewModeHref("course 1", "presentation")).toBe(
      "/courses/course%201/preview/presentation-mode",
    );
  });

  it("keeps lesson and block locations on the matching editor route", () => {
    expect(lessonEditorHref("course", "lesson one", "block/a")).toBe(
      "/courses/course/edit/standard-mode/lessons/lesson%20one?blockId=block%2Fa",
    );
    expect(
      lessonEditorHref("course", "lesson one", "block/a", "presentation"),
    ).toBe(
      "/courses/course/edit/presentation-mode?lessonId=lesson+one&blockId=block%2Fa",
    );
  });
});
