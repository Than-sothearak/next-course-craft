import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LessonMenu } from "@/app/courses/[courseId]/preview/_components/(course_preview_components)/lesson-menu";
import type { PreviewData } from "@/app/courses/[courseId]/preview/_components/(course_preview_components)/preview-types";

const lessons: PreviewData["lessons"] = [
  { id: "cover", sectionId: "section", title: "Cover", order: 0, lessonType: "content", quizQuestions: [], blocks: [] },
  { id: "practice", sectionId: "section", title: "Practice", order: 1, lessonType: "content", quizQuestions: [], blocks: [] },
];

function renderMenu(courseLayout: "slides" | "standard", lessonSearch = "", locked = false) {
  return renderToStaticMarkup(<LessonMenu
    initialData={{ title: "Canvas design", courseLayout }}
    progress={0}
    visitedLessonCount={0}
    lessons={lessons}
    sections={[{ id: "section", title: "Getting started", order: 0 }]}
    device="desktop"
    sidebarCollapsed={false}
    collapsedSectionIds={new Set()}
    lessonSearch={lessonSearch}
    selectedLesson={lessons[0]}
    lessonScrollProgress={{}}
    visitedLessonIds={new Set()}
    getLessonNavigationLockMessage={() => locked ? "Finish the previous slide" : null}
    selectLesson={() => {}}
    setCollapsedSectionIds={() => {}}
    setLessonSearch={() => {}}
    setMobileMenuOpen={() => {}}
    mobile
  />);
}

describe("preview lesson menu titles", () => {
  it("uses the course title for the first presentation slide and preserves later titles", () => {
    const markup = renderMenu("slides");
    expect(markup).toContain('aria-label="Canvas design"');
    expect(markup).toMatch(/<span[^>]*>Canvas design<\/span>/);
    expect(markup).not.toContain('aria-label="Cover"');
    expect(markup).toContain('aria-label="Practice"');
  });

  it("searches the displayed course title without relabeling filtered slides", () => {
    expect(renderMenu("slides", " CANVAS ")).toContain('aria-label="Canvas design"');
    expect(renderMenu("slides", "cover")).not.toContain('aria-label="Canvas design"');
    const markup = renderMenu("slides", "practice");
    expect(markup).toContain('aria-label="Practice"');
    expect(markup).not.toContain('aria-label="Canvas design"');
  });

  it("keeps navigation lock messages with the course title", () => {
    expect(renderMenu("slides", "", true)).toContain('aria-label="Canvas design. Locked. Finish the previous slide"');
  });

  it("preserves first lesson titles and search in standard courses", () => {
    expect(renderMenu("standard", "cover")).toContain('aria-label="Cover"');
    expect(renderMenu("standard", "canvas")).not.toContain('aria-label="Cover"');
  });
});
