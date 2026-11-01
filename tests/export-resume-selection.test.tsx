/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CoursePreview } from "@/app/courses/[courseId]/preview/course-preview";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import type { LearnerProgressAdapter, LearnerProgressSnapshot } from "@/lib/export/progress";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const course = (courseLayout: "slides" | "standard" = "slides") => ({ courseId: "export-resume", ...editorSnapshotSchema.parse({ title: "Export resume", description: "", revision: 1, courseLayout, sections: [{ id: "section", title: "Slides", order: 0 }], lessons: ["first", "second"].map((id, order) => ({ id, sectionId: "section", title: `${id} slide`, order, blocks: [] })) }) });
const snapshot = (selectedLessonId: string | null): LearnerProgressSnapshot => ({ selectedLessonId, visitedLessonIds: [], lessonScrollProgress: {}, revealedDividerIds: [], completedDividerIds: [] });
describe("exported lesson selection and resume", () => {
  let root: Root, container: HTMLDivElement, frames: Map<number, FrameRequestCallback>, frameId: number;
  const originalScroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollTo");
  beforeEach(() => { Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: vi.fn() }); });
  afterEach(() => { if (originalScroll) Object.defineProperty(HTMLElement.prototype, "scrollTo", originalScroll); else Reflect.deleteProperty(HTMLElement.prototype, "scrollTo"); });
  beforeEach(() => { frames = new Map(); frameId = 0; vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.set(++frameId, callback); return frameId; }); vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id)); vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} }); vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })); localStorage.clear(); container = document.createElement("div"); document.body.append(container); root = createRoot(container); });
  afterEach(() => { act(() => root.unmount()); container.remove(); localStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  async function render({ saved = "deleted-slide", initialLessonId, courseLayout = "slides", adapter = false, standalone = true }: { saved?: string | null; initialLessonId?: string; courseLayout?: "slides" | "standard"; adapter?: boolean; standalone?: boolean } = {}) {
    const progress = snapshot(saved), save = vi.fn();
    if (!adapter) localStorage.setItem("coursecraft-progress-v2-export-resume", JSON.stringify(progress));
    const progressAdapter: LearnerProgressAdapter | undefined = adapter ? { load: () => progress, save } : undefined;
    await act(async () => root.render(<CoursePreview initialData={course(courseLayout)} authorName="Author" initialLessonId={initialLessonId} standalone={standalone} progressAdapter={progressAdapter} />));
    for (let i = 0; i < 4; i++) await act(async () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach((callback) => callback(100 + i * 16)); });
    return save;
  }
  const visibleId = () => container.querySelector('article[aria-hidden="false"]')?.id;
  it.each([false, true])("falls back from a removed slide in stored progress without hiding all slides (LMS adapter=%s)", async (adapter) => { const save = await render({ adapter }); expect(visibleId()).toBe("preview-content-first"); expect(container.querySelector('[data-slide-active="true"]')).not.toBeNull(); if (adapter) expect(save).toHaveBeenLastCalledWith("export-resume", expect.objectContaining({ selectedLessonId: "first" }), false); else expect(JSON.parse(localStorage.getItem("coursecraft-progress-v2-export-resume")!).selectedLessonId).toBe("first"); });
  it.each([false, true])("resumes a slide that still exists (standalone=%s)", async (standalone) => { await render({ saved: "second", standalone }); expect(visibleId()).toBe("preview-content-second"); });
  it("lets a valid requested slide override saved resume", async () => { await render({ saved: "second", initialLessonId: "first" }); expect(visibleId()).toBe("preview-content-first"); });
  it("ignores an invalid requested slide while honoring valid resume", async () => { await render({ saved: "second", initialLessonId: "missing-request" }); expect(visibleId()).toBe("preview-content-second"); });
  it("falls back to the first slide when both requested and resumed slides are gone", async () => { await render({ initialLessonId: "missing-request" }); expect(visibleId()).toBe("preview-content-first"); });
  it("uses the first lesson for an invalid direct lesson request in Standard mode", async () => { await render({ initialLessonId: "missing-request", courseLayout: "standard" }); expect(visibleId()).toBe("preview-content-first"); });
  it("preserves the Standard overview when there is no valid saved lesson", async () => { await render({ courseLayout: "standard" }); expect(visibleId()).toBeUndefined(); expect(container.textContent).toContain("Start learning"); });
});
