import { describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { Course } from "../models/Course";
import { courseEditorPath, normalizeCourseEditorType } from "../lib/editor/editor-type";

describe("course editor type compatibility", () => {
  it("defaults courses without an editor type to the existing block editor", () => {
    const course = new Course({ ownerId: new Types.ObjectId(), title: "Legacy course" });
    expect(course.editorType).toBe("block");
    expect(normalizeCourseEditorType(undefined)).toBe("block");
  });

  it("routes each editor type to its own authoring path", () => {
    expect(courseEditorPath("course-1", "block")).toBe("/courses/course-1/edit");
    expect(courseEditorPath("course-1", "slide")).toBe("/courses/course-1/slides/edit");
  });
});
