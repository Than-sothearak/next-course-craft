// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CoursePreview, type PreviewData } from "@/app/courses/[courseId]/preview/course-preview";
import { blockSchema } from "@/lib/schemas/block";
import { getInteractiveBlockProgressIds, type LearnerProgressSnapshot } from "@/lib/export/progress";

const audio = blockSchema.parse({ id: "lesson-audio", version: 1, type: "audio", data: {
  src: "/api/assets/507f1f77bcf86cd799439011/file", fileName: "Introduction.mp3", mimeType: "audio/mpeg",
} });
function course(navigationMode: PreviewData["navigationMode"] = "restricted", gate = false): PreviewData {
  return {
    courseId: "audio-progress-course", title: "Audio course", description: "", authorVisible: false, navigationMode,
    sections: [{ id: "section", title: "Section", order: 0 }],
    lessons: [
      { id: "first", sectionId: "section", title: "Listen", order: 0, lessonType: "content", quizQuestions: [], blocks: [audio, ...(gate ? [blockSchema.parse({ id: "gate", version: 1, type: "divider", data: { style: "continue", label: "Continue", completionType: "completeAbove" } })] : [])] },
      { id: "second", sectionId: "section", title: "Second lesson", order: 1, lessonType: "content", quizQuestions: [], blocks: [] },
    ],
  };
}
let root: Root;
let container: HTMLDivElement;
let snapshot: LearnerProgressSnapshot | null;
const adapter = {
  load: () => snapshot,
  save: (_courseId: string, value: LearnerProgressSnapshot) => { snapshot = value; },
};
const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
const secondLesson = () => container.querySelector<HTMLButtonElement>('aside button[aria-label^="Second lesson"]')!;
const continueButton = () => container.querySelector<HTMLButtonElement>('[data-lesson-block-id="gate"] button')!;
function readToEnd() {
  const reader = container.querySelector<HTMLElement>("#preview-content-first > div")!;
  Object.defineProperties(reader, {
    scrollHeight: { configurable: true, value: 1000 }, clientHeight: { configurable: true, value: 500 },
    scrollTop: { configurable: true, writable: true, value: 500 },
  });
  act(() => reader.dispatchEvent(new Event("scroll")));
}
async function render(data: PreviewData, standalone: boolean) {
  await act(async () => root.render(<CoursePreview initialData={data} authorName="Author" initialLessonId="first" standalone={standalone} progressAdapter={adapter} />));
  await settle();
  readToEnd();
  await settle();
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  snapshot = null;
  localStorage.clear();
  vi.stubGlobal("IntersectionObserver", class {
    observe() {} unobserve() {} disconnect() {}
  });
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0));
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
  Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: vi.fn() });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("audio learner completion", () => {
  it.each([false, true])("unlocks restricted progression only after playback ends and restores completion (standalone=%s)", async (standalone) => {
    const data = course();
    await render(data, standalone);
    expect(secondLesson().disabled).toBe(true);
    expect(snapshot!.visitedLessonIds).not.toContain("first");
    expect(snapshot!.lessonScrollProgress.first).toBe(50);
    const player = container.querySelector("audio")!;
    for (const event of ["play", "pause", "timeupdate", "seeked"]) act(() => player.dispatchEvent(new Event(event)));
    await settle();
    expect(snapshot!.interactedContentIds).not.toContain("lesson-audio:listened");
    expect(secondLesson().disabled).toBe(true);
    act(() => player.dispatchEvent(new Event("ended")));
    await settle();
    expect(snapshot!.interactedContentIds).toContain("lesson-audio:listened");
    expect(snapshot!.visitedLessonIds).toContain("first");
    expect(snapshot!.lessonScrollProgress.first).toBe(100);
    expect(secondLesson().disabled).toBe(false);

    act(() => root.unmount());
    root = createRoot(container);
    await render(data, standalone);
    expect(snapshot!.interactedContentIds).toContain("lesson-audio:listened");
    expect(secondLesson().disabled).toBe(false);
  });

  it.each(["free", "sequential"] as const)("keeps audio optional for %s reading completion without a required gate", async (mode) => {
    await render(course(mode), true);
    expect(snapshot!.visitedLessonIds).toContain("first");
    expect(snapshot!.interactedContentIds).not.toContain("lesson-audio:listened");
    expect(secondLesson().disabled).toBe(false);
  });

  it.each([false, true])("requires audio above a completion gate, including free navigation (standalone=%s)", async (standalone) => {
    await render(course("free", true), standalone);
    expect(continueButton().disabled).toBe(true);
    act(() => container.querySelector("audio")!.dispatchEvent(new Event("ended")));
    await settle();
    expect(continueButton().disabled).toBe(false);
    act(() => continueButton().click());
    await settle();
    expect(snapshot!.revealedDividerIds).toContain("gate");
  });

  it("does not block progression for an empty authoring placeholder", () => {
    const empty = blockSchema.parse({ id: "empty", version: 1, type: "audio", data: { src: "" } });
    expect(getInteractiveBlockProgressIds(empty)).toEqual([]);
    expect(getInteractiveBlockProgressIds(audio)).toEqual(["lesson-audio:listened"]);
  });
});
