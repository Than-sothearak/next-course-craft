// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorTopbar } from "../app/courses/[courseId]/edit/presentation-mode/_components/slide-presentation/editor-topbar";
import { defaultCourseNavigationMode } from "../lib/editor/navigation";
import { defaultCourseTheme } from "../lib/editor/theme";

vi.mock("@/app/courses/[courseId]/edit/_components/(editor_client_components)/course-navigation-settings", () => ({
  CourseNavigationSettings: () => null,
}));
vi.mock("@/app/courses/[courseId]/edit/_components/(editor_client_components)/course-theme-settings", () => ({
  CourseThemeSettings: () => null,
}));

describe("lesson editor back navigation", () => {
  let root: Root | undefined;
  let container: HTMLDivElement | undefined;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  });

  afterEach(() => {
    if (root) act(() => root?.unmount());
    container?.remove();
    root = undefined;
    container = undefined;
    vi.unstubAllGlobals();
  });

  it("uses the save-aware back action from a focused lesson", () => {
    const onBackToCourse = vi.fn();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    act(() => root?.render(
      <EditorTopbar
        slideCourse={false}
        isPresentationWorkspace={false}
        focusedLessonId="lesson-1"
        courseId="course-1"
        lessonTitle="Lesson 1"
        courseTitle="Course"
        hasActiveLesson
        canManageBlocks
        saveStatus={<span>Saved</span>}
        saveState="saved"
        saveMessage=""
        onRetrySave={vi.fn()}
        blockManagerOpen={false}
        onToggleBlockManager={vi.fn()}
        theme={defaultCourseTheme}
        onThemeChange={vi.fn()}
        navigationMode={defaultCourseNavigationMode}
        onNavigationModeChange={vi.fn()}
        canUndo={false}
        canRedo={false}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        onPreview={vi.fn()}
        onBackToOutline={vi.fn()}
        onBackToCourse={onBackToCourse}
        onBackToDashboard={vi.fn()}
        onReloadCourse={vi.fn()}
      />,
    ));

    const backButton = container.querySelector<HTMLButtonElement>('button[aria-label="Back to course"]');
    expect(backButton).not.toBeNull();
    expect(container.querySelector('a[aria-label="Back to course"]')).toBeNull();

    act(() => backButton?.click());
    expect(onBackToCourse).toHaveBeenCalledOnce();
  });

  it("routes the dashboard back control through its save-aware callback", () => {
    const onBackToDashboard = vi.fn();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    act(() => root?.render(
      <EditorTopbar
        slideCourse
        isPresentationWorkspace
        courseId="course-1"
        courseTitle="Course"
        hasActiveLesson={false}
        canManageBlocks={false}
        saveStatus={<span>Saved</span>}
        saveState="saved"
        saveMessage=""
        onRetrySave={vi.fn()}
        blockManagerOpen={false}
        onToggleBlockManager={vi.fn()}
        theme={defaultCourseTheme}
        onThemeChange={vi.fn()}
        navigationMode={defaultCourseNavigationMode}
        onNavigationModeChange={vi.fn()}
        canUndo={false}
        canRedo={false}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        onPreview={vi.fn()}
        onBackToOutline={vi.fn()}
        onBackToCourse={vi.fn()}
        onBackToDashboard={onBackToDashboard}
        onReloadCourse={vi.fn()}
      />,
    ));

    const backButton = container.querySelector<HTMLButtonElement>('button[aria-label="Back to dashboard"]');
    expect(backButton).not.toBeNull();
    expect(container.querySelector('a[aria-label="Back to dashboard"]')).toBeNull();
    act(() => backButton?.click());
    expect(onBackToDashboard).toHaveBeenCalledOnce();
  });
});
