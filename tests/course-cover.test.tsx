import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CourseCover } from "../components/course-cover";
import { courseCoverSchema, courseCoverTemplates, defaultCourseCover } from "../lib/editor/course-cover";
import { courseThemeSchema, defaultCourseTheme, normalizeCourseTheme } from "../lib/editor/theme";
import { parseScorm12Snapshot } from "../lib/scorm12/snapshot";
import { CoursePreview } from "../app/courses/[courseId]/preview/course-preview";

const base = { title: "Course cover test", description: "", revision: 0, sections: [{ id: "learn", title: "Learn", order: 0 }], lessons: [{ id: "lesson", sectionId: "learn", title: "Introduction", order: 0, blocks: [] }] };

describe("course cover templates", () => {
  it.each(courseCoverTemplates)("keeps $id covers in validated snapshots and both learner views", ({ id }) => {
    const cover = courseCoverSchema.parse({ template: id, backgroundColor: "#123456", alignment: "left", textColor: "#fedcba", ...(id === "image" ? { imageSrc: "/api/assets/123456789012345678901234/file", imageAlt: "A landscape", imagePosition: "top", overlayOpacity: 65 } : {}) });
    const snapshot = parseScorm12Snapshot({ ...base, theme: { ...defaultCourseTheme, cover } });
    expect(snapshot.theme.cover).toEqual(cover);
    for (const standalone of [false, true]) {
      const html = renderToStaticMarkup(createElement(CoursePreview, { initialData: { ...snapshot, courseId: "course" }, authorName: "Author", standalone }));
      expect(html).toContain(`data-course-cover="${id}"`);
      expect(html).toContain("background-color:#123456");
      expect(html).toContain("color:#fedcba");
      expect(html).toContain("text-align:left");
      expect(html).toContain("Start learning");
      if (id === "image") {
        expect(html).toContain('alt="A landscape"');
        expect(html).toContain("object-position:top");
        expect(html).toContain("opacity:0.65");
      }
    }
  });

  it("uses the existing gradient for older courses and a safe fallback for an empty image cover", () => {
    expect(courseThemeSchema.parse({}).cover).toBeUndefined();
    const html = renderToStaticMarkup(<CourseCover cover={{ ...defaultCourseCover, template: "image" }} primaryColor="#2f5f9f" accentColor="#ff876c">Course title</CourseCover>);
    expect(html).toContain("linear-gradient");
    expect(html).not.toContain("<img");
  });

  it.each(["./media/123456789012345678901234.png", "data:image/png;base64,aGVsbG8="])("keeps rewritten offline image sources: %s", (imageSrc) => {
    const theme = normalizeCourseTheme({ ...defaultCourseTheme, cover: { template: "image", imageSrc } });
    expect(theme.cover?.imageSrc).toBe(imageSrc);
    expect(renderToStaticMarkup(<CourseCover cover={theme.cover} primaryColor={theme.primaryColor} accentColor={theme.accentColor}>Title</CourseCover>)).toContain(`src="${imageSrc}"`);
  });

  it.each([
    { template: "unknown" }, { backgroundColor: "url(javascript:bad)" }, { overlayOpacity: 100 }, { overlayOpacity: -1 },
    { imageSrc: "javascript:alert(1)" }, { imageSrc: "//example.com/image.png" }, { imageSrc: "data:text/html;base64,aGVsbG8=" }, { imageSrc: "/api/other-route" },
  ])("rejects invalid or unsafe cover settings: %j", (cover) => {
    expect(courseCoverSchema.safeParse(cover).success).toBe(false);
  });
});
