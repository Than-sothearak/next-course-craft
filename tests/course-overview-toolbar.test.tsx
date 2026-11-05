import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CourseOverviewToolbar } from "../app/courses/[courseId]/edit/_components/course-overview-toolbar";
import { defaultCourseNavigationMode } from "../lib/editor/navigation";
import { defaultCourseTheme } from "../lib/editor/theme";

vi.mock("@/app/dashboard/_components/dashboard-navbar", () => ({
  DashboardNavbar: ({ primaryAction }: { primaryAction: React.ReactNode }) => (
    <header>{primaryAction}</header>
  ),
}));

function renderToolbar(slideCourse: boolean) {
  return renderToStaticMarkup(createElement(CourseOverviewToolbar, {
    courseId: "course-1",
    title: "Course",
    theme: defaultCourseTheme,
    navigationMode: defaultCourseNavigationMode,
    globalPermissions: [],
    userName: "Author",
    saveStatus: createElement("span", null, "Saved"),
    canUndo: true,
    canRedo: true,
    slideCourse,
    canGenerate: false,
    canPublish: false,
    onBack: vi.fn(),
    onForward: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onGenerate: vi.fn(),
    onThemeChange: vi.fn(),
    onNavigationModeChange: vi.fn(),
    onPreview: vi.fn(),
  }));
}

describe("course overview edit history actions", () => {
  it("shows undo and redo for Standard mode", () => {
    const markup = renderToolbar(false);

    expect(markup).toContain('aria-label="Edit history"');
    expect(markup).toContain('aria-label="Undo"');
    expect(markup).toContain('aria-label="Redo"');
    expect(markup).toContain("size-8 rounded-md text-slate-500");
    expect(markup.indexOf('aria-label="Undo"')).toBeLessThan(markup.indexOf('aria-label="Preview"'));
  });

  it("hides undo and redo from the Presentation course overview", () => {
    const markup = renderToolbar(true);

    expect(markup).not.toContain('aria-label="Edit history"');
    expect(markup).not.toContain('aria-label="Undo"');
    expect(markup).not.toContain('aria-label="Redo"');
  });
});
