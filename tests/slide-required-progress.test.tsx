/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CoursePreview } from "@/app/courses/[courseId]/preview/course-preview";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import type { LearnerProgressSnapshot } from "@/lib/export/progress";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function course(required = true, navigationMode = "restricted") {
  return { courseId: "slide-requirements", ...editorSnapshotSchema.parse({
    title: "Requirements", description: "", revision: 1, courseLayout: "slides", navigationMode,
    sections: [{ id: "section", title: "Slides", order: 0 }],
    lessons: [
      { id: "first", sectionId: "section", title: "Activities", order: 0, blocks: [
        { id: "question", version: 1, type: "knowledgeCheck", requiredForProgress: required, data: { question: "Ready?", options: ["Yes", "No"] } },
        { id: "video", version: 1, type: "video", requiredForProgress: false, data: { src: "/clip.webm", mimeType: "video/webm" } },
        { id: "continue", version: 1, type: "divider", requiredForProgress: false, data: { style: "continue", label: "Continue", completionType: "completeAbove" } },
        { id: "tail", version: 1, type: "heading", data: { text: "Visible after optional Continue", level: 2 } },
      ] },
      { id: "second", sectionId: "section", title: "Next slide", order: 1, blocks: [] },
    ],
  }) };
}

describe("presentation requirements in learner navigation", () => {
  let root: Root;
  let container: HTMLDivElement;
  let save: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => setTimeout(() => callback(0), 16));
    vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(function (this: HTMLElement) { return this.hasAttribute("data-slide-canvas") ? 540 : 0; });
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(function (this: HTMLElement) { return this.hasAttribute("data-slide-canvas") ? 540 : 0; });
    Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: vi.fn() });
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    save = vi.fn(); container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollTo; vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
  const settle = () => act(async () => vi.advanceTimersByTimeAsync(100));
  const next = () => [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.trim() === "Next")!;
  const snapshot = () => save.mock.calls.at(-1)![1] as LearnerProgressSnapshot;
  async function render(required: boolean, standalone: boolean, navigationMode = "restricted") {
    const adapter = { load: () => null, save };
    await act(async () => root.render(<CoursePreview initialData={course(required, navigationMode)} authorName="" initialLessonId="first" standalone={standalone} persistLocalProgress={false} progressAdapter={adapter} />));
    await settle();
  }

  it.each([false, true])("locks only required activities and tracks optional interactions (standalone=%s)", async (standalone) => {
    await render(true, standalone);
    expect(next().disabled).toBe(true);
    expect(container.textContent).toContain("Visible after optional Continue");
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "PageDown" })));
    expect(container.querySelector('#preview-content-first')?.getAttribute("aria-hidden")).toBe("false");
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Open slide menu"]')!.click());
    expect(container.querySelector<HTMLButtonElement>('[aria-label^="Next slide. Locked"]')?.disabled).toBe(true);
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Close slide menu"]')!.click());
    await act(async () => container.querySelector("video")!.dispatchEvent(new Event("ended"))); await settle();
    expect(snapshot().interactedContentIds).toContain("video:watched"); expect(next().disabled).toBe(true);
    await act(async () => container.querySelector<HTMLInputElement>('input[type="radio"]')!.click());
    await act(async () => [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.trim() === "Check answer")!.click()); await settle();
    expect(next().disabled).toBe(false);
    expect(snapshot().visitedLessonIds).toContain("first"); expect(snapshot().lessonScrollProgress.first).toBe(100);
    expect(snapshot().interactedContentIds).toContain("question:answer");
    await act(async () => next().click()); await settle();
    expect(container.querySelector('#preview-content-second')?.getAttribute("aria-hidden")).toBe("false");
  });

  it.each([false, true])("lets learners continue past an entirely optional slide without completing its activities (standalone=%s)", async (standalone) => {
    await render(false, standalone);
    expect(next().disabled).toBe(false);
    expect(snapshot().lessonScrollProgress.first).toBe(100);
    expect(snapshot().visitedLessonIds).toContain("first");
    expect(snapshot().interactedContentIds).not.toContain("question:answer"); expect(snapshot().interactedContentIds).not.toContain("video:watched");
    expect(container.querySelector<HTMLInputElement>('input[type="radio"]')?.disabled).toBe(false);
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "PageDown" }))); await settle();
    expect(container.querySelector('#preview-content-second')?.getAttribute("aria-hidden")).toBe("false");
  });

  it.each(["free", "sequential"])("preserves %s course navigation even when a block is marked required", async (mode) => {
    await render(true, true, mode); expect(next().disabled).toBe(false);
  });
});
