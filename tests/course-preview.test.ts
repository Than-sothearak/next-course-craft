import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  CoursePreview,
  type PreviewData,
} from "../app/courses/[courseId]/preview/course-preview";

const initialData: PreviewData = {
  courseId: "course-1",
  title: "Shared course title",
  description: "",
  authorVisible: false,
  sections: [{ id: "section-1", title: "Getting started", order: 0 }],
  lessons: [
    {
      id: "lesson-1",
      sectionId: "section-1",
      title: "First lesson",
      lessonType: "content",
      icon: "file",
      order: 0,
      blocks: [],
      quizQuestions: [],
    },
  ],
};

describe("shared course preview player", () => {
  it("uses the same course content while hiding author controls in HTML5 mode", () => {
    const standalone = renderToStaticMarkup(
      createElement(CoursePreview, {
        initialData,
        authorName: "Course author",
        standalone: true,
      }),
    );
    const preview = renderToStaticMarkup(
      createElement(CoursePreview, {
        initialData,
        authorName: "Course author",
      }),
    );

    expect(standalone).toContain("First lesson");
    expect(standalone).not.toContain("Course Preview");
    expect(standalone).not.toContain("HTML5");
    expect(preview).toContain("First lesson");
    expect(preview).toContain("Course Preview");
    expect(preview).toContain("HTML5");
  });
});
