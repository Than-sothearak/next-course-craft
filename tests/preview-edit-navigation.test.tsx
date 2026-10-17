/** @vitest-environment jsdom */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CoursePreviewRoute } from "../app/courses/[courseId]/preview/course-preview-route";
import { CoursePreview, type PreviewData } from "../app/courses/[courseId]/preview/course-preview";
import { previewEditTarget } from "../app/courses/[courseId]/preview/_components/(course_preview_components)/preview-edit-target";
import { useFocusedContentBlock } from "../app/courses/[courseId]/edit/_components/(editor_client_components)/use-focused-content-block";
import { editorBlockElementId, lessonEditorHref } from "../lib/editor/lesson-location";
import { blockSchema } from "../lib/schemas/block";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const initialData: PreviewData = {
  courseId: "course-1", title: "Example course", description: "", authorVisible: false,
  navigationMode: "free", sections: [{ id: "section-1", title: "Learn", order: 0 }],
  lessons: [1, 2].map((number) => ({
    id: `lesson-${number}`, sectionId: "section-1", title: `Lesson ${number}`, order: number - 1,
    icon: "book", lessonType: "content", quizQuestions: [],
    blocks: [1, 2].map((block) => blockSchema.parse({ id: `block-${number}-${block}`, version: 1, type: "divider", data: { style: "line", label: "", completionType: "none" } })),
  })),
};

function rect(top: number, bottom: number): DOMRect {
  return { top, bottom, height: bottom - top, left: 0, right: 100, width: 100, x: 0, y: top, toJSON: () => ({}) };
}

describe("preview links to the exact editor block", () => {
  let container: HTMLDivElement;
  let root: Root;
  let frames: FrameRequestCallback[];
  const originalScrollTo = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollTo");
  beforeEach(() => {
    push.mockClear();
    frames = [];
    Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: vi.fn() });
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => { frames.push(callback); return frames.length; }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    if (originalScrollTo) Object.defineProperty(HTMLElement.prototype, "scrollTo", originalScrollTo);
    else Reflect.deleteProperty(HTMLElement.prototype, "scrollTo");
  });

  it("uses only the navbar Edit button without adding buttons inside preview blocks", async () => {
    await act(async () => root.render(createElement(CoursePreviewRoute, { canEdit: true, initialData, authorName: "Author", initialLessonId: "lesson-2" })));
    expect(container.querySelector('[aria-label^="Edit block"]')).toBeNull();
    expect(Array.from(container.querySelectorAll<HTMLButtonElement>("header button")).filter((button) => button.textContent?.trim() === "Edit")).toHaveLength(1);
    expect(container.querySelector('[data-lesson-block-id] button')).toBeNull();
  });

  it("routes toolbar Edit to the lesson and block currently in view", async () => {
    await act(async () => root.render(createElement(CoursePreviewRoute, { canEdit: true, initialData, authorName: "Author", initialLessonId: "lesson-2" })));
    const article = container.querySelector("#preview-content-lesson-2")!;
    const body = article.firstElementChild as HTMLElement;
    body.getBoundingClientRect = () => rect(0, 500);
    const blocks = article.querySelectorAll<HTMLElement>("[data-lesson-block-id]");
    blocks[0].getBoundingClientRect = () => rect(-100, -20);
    blocks[1].getBoundingClientRect = () => rect(20, 200);
    const edit = Array.from(container.querySelectorAll<HTMLButtonElement>("header button")).find((button) => button.textContent?.trim() === "Edit")!;
    act(() => edit.click());
    expect(push).toHaveBeenCalledWith("/courses/course-1/edit/lessons/lesson-2?blockId=block-2-2");
  });

  it("lays out only the selected lesson instead of scrolling a stack of full-height articles", async () => {
    await act(async () => root.render(createElement(CoursePreviewRoute, { canEdit: true, initialData, authorName: "Author", initialLessonId: "lesson-2" })));
    const first = container.querySelector("#preview-content-lesson-1")!;
    const second = container.querySelector("#preview-content-lesson-2")!;
    expect(first.classList.contains("hidden")).toBe(true);
    expect(second.classList.contains("hidden")).toBe(false);
    expect(second.getAttribute("aria-hidden")).toBe("false");
    act(() => container.querySelector<HTMLButtonElement>('aside [aria-label="Lesson 1"]')!.click());
    expect(first.classList.contains("hidden")).toBe(false);
    expect(second.classList.contains("hidden")).toBe(true);
  });

  it("keeps the lesson scroll element and reading position when switching devices or course view", async () => {
    await act(async () => root.render(createElement(CoursePreviewRoute, { canEdit: true, initialData, authorName: "Author", initialLessonId: "lesson-2" })));
    const body = container.querySelector<HTMLElement>("#preview-content-lesson-2 > div")!;
    body.scrollTop = 130;
    for (const device of ["mobile", "tablet", "desktop"]) {
      act(() => container.querySelector<HTMLButtonElement>(`[aria-label="Preview on ${device}"]`)!.click());
      expect(container.querySelector("#preview-content-lesson-2 > div")).toBe(body);
      expect(body.scrollTop).toBe(130);
    }
    const button = (text: string) => Array.from(container.querySelectorAll<HTMLButtonElement>("header button")).find((element) => element.textContent?.trim() === text)!;
    act(() => button("Preview course").click());
    expect(container.querySelector("#preview-content-lesson-2 > div")).toBe(body);
    act(() => button("Learn").click());
    expect(body.scrollTop).toBe(130);
    expect(container.querySelector("#preview-content-lesson-2")?.getAttribute("aria-hidden")).toBe("false");
  });

  it("leaves 60px between lesson content and the Previous/Next section controls on every device", async () => {
    await act(async () => root.render(createElement(CoursePreviewRoute, { canEdit: true, initialData, authorName: "Author", initialLessonId: "lesson-1" })));
    for (const device of ["desktop", "tablet", "mobile"]) {
      act(() => container.querySelector<HTMLButtonElement>(`[aria-label="Preview on ${device}"]`)!.click());
      const previous = container.querySelector('nav[aria-label="Previous section from content 1"]')!;
      const next = container.querySelector('nav[aria-label="Next section from content 1"]')!;
      expect(previous.className).toContain("mb-[60px]");
      expect(previous.nextElementSibling?.className).not.toContain("py-8");
      expect(next.className).toContain("pt-[60px]");
      expect(next.className).toContain("mt-auto");
    }
  });

  it("returns to the course overview from the first lesson's Previous control", async () => {
    await act(async () => root.render(createElement(CoursePreviewRoute, { canEdit: true, initialData, authorName: "Author", initialLessonId: "lesson-1" })));
    const previousButton = container.querySelector<HTMLButtonElement>('nav[aria-label="Previous section from content 1"] button')!;

    expect(previousButton.disabled).toBe(false);
    expect(previousButton.textContent).toContain("Preview course");
    act(() => previousButton.click());

    const previewModeButton = Array.from(container.querySelectorAll<HTMLButtonElement>("header button"))
      .find((button) => button.textContent?.trim() === "Preview course");
    expect(previewModeButton?.getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector('[aria-label="Course cover"]')).not.toBeNull();
  });

  it("keeps course overview Edit pointing to the course editor", async () => {
    await act(async () => root.render(createElement(CoursePreviewRoute, { canEdit: true, initialData, authorName: "Author" })));
    const edit = Array.from(container.querySelectorAll<HTMLButtonElement>("header button")).find((button) => button.textContent?.trim() === "Edit")!;
    act(() => edit.click());
    expect(push).toHaveBeenCalledWith("/courses/course-1/edit");
  });

  it("keeps block editing controls out of the standalone learner export", async () => {
    await act(async () => root.render(createElement(CoursePreview, { initialData, authorName: "Author", initialLessonId: "lesson-2", standalone: true, onEdit: vi.fn() })));
    expect(container.querySelector('[aria-label^="Edit block"]')).toBeNull();
    expect(container.querySelector("header")).toBeNull();
  });

  it("falls back to the lesson when no block is visible and encodes route values", () => {
    expect(previewEditTarget("lesson-2", container)).toEqual({ lessonId: "lesson-2" });
    expect(previewEditTarget(null, container)).toBeUndefined();
    expect(lessonEditorHref("course", "lesson name", "block/a?b")).toBe("/courses/course/edit/lessons/lesson%20name?blockId=block%2Fa%3Fb");
  });

  it("scrolls to and focuses the requested editable block only once", async () => {
    function Probe() {
      useFocusedContentBlock("lesson-2", "lesson-2", "block-2-2");
      return createElement("div", { id: editorBlockElementId("block-2-2"), tabIndex: -1 }, createElement("div", { contentEditable: true, suppressContentEditableWarning: true, tabIndex: 0 }, "Edit this text"));
    }
    await act(async () => root.render(createElement(Probe)));
    const target = container.firstElementChild as HTMLElement;
    target.scrollIntoView = vi.fn();
    act(() => frames.splice(0).forEach((frame) => frame(0)));
    expect(target.scrollIntoView).toHaveBeenCalledWith({ block: "start", behavior: "auto" });
    expect(document.activeElement).toBe(target.firstElementChild);
    await act(async () => root.render(createElement(Probe)));
    expect(target.scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("opens content settings for a block without inline editable text", async () => {
    const openSettings = vi.fn();
    function Probe() {
      useFocusedContentBlock("lesson-2", "lesson-2", "image-block");
      return createElement("div", { id: editorBlockElementId("image-block"), tabIndex: -1 }, createElement("button", { "aria-label": "Open content settings", onClick: openSettings }, "Settings"));
    }
    await act(async () => root.render(createElement(Probe)));
    const target = container.firstElementChild as HTMLElement;
    target.scrollIntoView = vi.fn();
    act(() => frames.splice(0).forEach((frame) => frame(0)));
    expect(openSettings).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(target.firstElementChild);
  });
});
