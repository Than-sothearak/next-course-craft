/** @vitest-environment jsdom */
import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { CourseOutline } from "@/app/courses/[courseId]/edit/standard-mode/_components/course-outline";
import { SlideEditorSidebar } from "@/app/courses/[courseId]/edit/presentation-mode/_components/slide-presentation/slide-editor-sidebar";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
const snapshot = editorSnapshotSchema.parse({ title: "Course", description: "", revision: 0, sections: [{ id: "learn", title: "Learn", order: 0 }], lessons: [
  { id: "saved", sectionId: "learn", title: "Saved lesson", order: 0, blocks: [] },
  { id: "pending", sectionId: "learn", title: "Pending private title", order: 1, blocks: [] },
  { id: "manual", sectionId: "learn", title: "Manual empty draft", order: 2, blocks: [] },
] });
let root: Root, container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() }));
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
function outlineProps(pendingLessonIds: ReadonlySet<string>): ComponentProps<typeof CourseOutline> {
  return { currentCourseId: "course", sections: snapshot.sections, lessons: snapshot.lessons, activeLessonId: null, pendingLessonIds,
    onSelectLesson: vi.fn(), onAddSection: vi.fn(), onRenameSection: vi.fn(), onMoveSection: vi.fn(), onDuplicateSection: vi.fn(), onDeleteSection: vi.fn(), onAddLesson: vi.fn(), onAddQuiz: vi.fn(), onDuplicateLesson: vi.fn(), onMoveLesson: vi.fn(), onDeleteLesson: vi.fn(), onChangeLessonIcon: vi.fn(), onReorderLessons: vi.fn(),
  };
}
describe("lesson generation skeletons", () => {
  it("hides pending titles and actions while keeping saved lessons and manual drafts available", async () => {
    const props = outlineProps(new Set(["pending"]));
    await act(async () => root.render(<CourseOutline {...props} />));
    expect(container.textContent).toContain("Saved lesson"); expect(container.textContent).toContain("Manual empty draft");
    expect(container.textContent).not.toContain("Pending private title");
    const skeleton = container.querySelector('[data-pending-lesson-id="pending"]')!;
    expect(skeleton.getAttribute("aria-busy")).toBe("true"); expect(skeleton.querySelector("button")).toBeNull();
    expect(container.querySelector('[aria-label="Content actions for Pending private title"]')).toBeNull();
    await act(async () => root.render(<CourseOutline {...props} pendingLessonIds={new Set()} />));
    expect(container.querySelector('[data-pending-lesson-id]')).toBeNull();
    expect(container.textContent).toContain("Pending private title");
    expect(container.querySelector('[aria-label="Content actions for Pending private title"]')).not.toBeNull();
  });
  it("replaces pending slide thumbnails with skeletons until the saved result arrives", async () => {
    const props: ComponentProps<typeof SlideEditorSidebar> = { slides: snapshot.lessons, activeId: "saved", pendingLessonIds: new Set(["pending"]), onSelect: vi.fn(), onAdd: vi.fn(), onDelete: vi.fn(), onReorder: vi.fn() };
    await act(async () => root.render(<SlideEditorSidebar {...props} />));
    expect(container.querySelector('[data-pending-lesson-id="pending"]')).not.toBeNull();
    expect(container.querySelector('[aria-label*="Pending private title"]')).toBeNull();
    expect(container.querySelector('[aria-label="Edit slide 1: Saved lesson"]')).not.toBeNull();
    await act(async () => root.render(<SlideEditorSidebar {...props} pendingLessonIds={new Set()} />));
    expect(container.querySelector('[data-pending-lesson-id]')).toBeNull();
    expect(container.querySelector('[aria-label="Edit slide 2: Pending private title"]')).not.toBeNull();
  });
});
