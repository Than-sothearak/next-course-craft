/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CoursePreview, type PreviewData } from "@/app/courses/[courseId]/preview/course-preview";
import { blockSchema, type ContentBlock } from "@/lib/schemas/block";
import type { LearnerProgressSnapshot } from "@/lib/export/progress";
import { setMediaPlayback } from "./helpers/media-playback";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const src = "/api/assets/aaaaaaaaaaaaaaaaaaaaaaaa/file";
const mediaBlock = (type: "audio" | "video") => blockSchema.parse({ id: "media", version: 1, type, data: { src, mimeType: type === "video" ? "video/webm" : "audio/mpeg" } });
const flip = blockSchema.parse({ id: "flip", type: "flipCard", version: 1, data: { cards: [{ id: "one", frontLabel: "Question", backLabel: "Answer", front: { type: "text", text: "Prompt" }, back: { type: "text", text: "Answer" } }] } });
function course(blocks: ContentBlock[], layout: "slides" | "standard" = "slides"): PreviewData {
  return { courseId: "action-progress", title: "Actions", description: "", authorVisible: false, courseLayout: layout, navigationMode: "restricted", sections: [{ id: "section", title: "Section", order: 0 }], lessons: [
    { id: "first", sectionId: "section", title: "First slide", order: 0, lessonType: "content", blocks, quizQuestions: [] },
    { id: "second", sectionId: "section", title: "Second slide", order: 1, lessonType: "content", blocks: [], quizQuestions: [] },
  ] };
}

describe("presentation menu action progress", () => {
  let root: Root; let container: HTMLDivElement; let saved: LearnerProgressSnapshot | null;
  const adapter = { load: () => saved, save: (_id: string, progress: LearnerProgressSnapshot) => { saved = progress; } };
  const settle = () => act(async () => vi.advanceTimersByTimeAsync(100));
  const firstMenuItem = () => container.querySelector<HTMLButtonElement>('button[aria-current="page"]')!;
  const next = () => container.querySelector<HTMLButtonElement>('[data-slide-active="true"] [data-slide-footer] [aria-label="Next"]')!;
  const circle = () => firstMenuItem().querySelector('svg[role="img"]')?.getAttribute("aria-label");
  async function render(data: PreviewData, standalone = true) {
    await act(async () => root.render(<CoursePreview initialData={data} initialLessonId="first" authorName="" standalone={standalone} progressAdapter={adapter} persistLocalProgress={false} />));
    await settle();
    if (data.courseLayout === "slides") await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Open slide menu"]')!.click());
  }
  beforeEach(() => {
    saved = null; vi.useFakeTimers();
    vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => setTimeout(() => callback(0), 16));
    vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(540);
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(540);
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: vi.fn() });
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollTo; vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

  it.each([false, true])("starts at zero and advances the menu circle every four seconds of a 40-second video (standalone=%s)", async (standalone) => {
    await render(course([mediaBlock("video")]), standalone);
    expect(circle()).toBe("Lesson 0% complete");
    expect(next().disabled).toBe(true);
    const media = container.querySelector("video")!;
    for (let step = 1; step <= 10; step++) {
      setMediaPlayback(media, [[0, step * 4]], step * 4, 40);
      act(() => media.dispatchEvent(new Event("timeupdate")));
      await settle();
      expect(circle()).toBe(`Lesson ${Math.min(90, step * 10)}% complete`);
      expect(next().disabled).toBe(true);
      expect(container.querySelector("[data-media-progress]")).toBeNull();
    }
    act(() => media.dispatchEvent(new Event("ended"))); await settle();
    expect(firstMenuItem().querySelector('[aria-label="Lesson complete"]')).not.toBeNull();
    expect(next().disabled).toBe(false);
  });

  it("combines watched duration with required actions and ignores passive viewing and optional activities", async () => {
    await render(course([mediaBlock("audio"), flip, { ...flip, id: "optional", requiredForProgress: false }]));
    expect(circle()).toBe("Lesson 0% complete");
    const media = container.querySelector("audio")!;
    setMediaPlayback(media, [[0, 20]], 20, 40);
    act(() => media.dispatchEvent(new Event("timeupdate"))); await settle();
    expect(circle()).toBe("Lesson 25% complete");
    await act(async () => container.querySelector<HTMLButtonElement>('[data-flip-card-id="one"]')!.click()); await settle();
    expect(circle()).toBe("Lesson 75% complete");
    setMediaPlayback(media, [[0, 40]], 40, 40);
    act(() => media.dispatchEvent(new Event("ended"))); await settle();
    expect(saved!.lessonScrollProgress.first).toBe(100);
    expect(next().disabled).toBe(false);
  });

  it("recalculates old reading credit and resumes source-bound audio checkpoints", async () => {
    saved = { visitedLessonIds: [], lessonScrollProgress: { first: 50 }, revealedDividerIds: [], completedDividerIds: [], selectedLessonId: "first" };
    const data = course([mediaBlock("audio")]);
    await render(data);
    expect(circle()).toBe("Lesson 0% complete");
    const media = container.querySelector("audio")!;
    setMediaPlayback(media, [[0, 20]], 20, 40);
    act(() => media.dispatchEvent(new Event("timeupdate"))); await settle();
    expect(circle()).toBe("Lesson 50% complete");
    act(() => root.unmount()); root = createRoot(container);
    await render(data);
    const resumed = container.querySelector("audio")!;
    setMediaPlayback(resumed, [], 0, 40);
    act(() => resumed.dispatchEvent(new Event("loadedmetadata"))); await settle();
    expect(resumed.currentTime).toBe(20);
    expect(circle()).toBe("Lesson 50% complete");
    expect(next().disabled).toBe(true);
    setMediaPlayback(resumed, [[20, 24]], 24, 40);
    act(() => resumed.dispatchEvent(new Event("timeupdate"))); await settle();
    expect(circle()).toBe("Lesson 60% complete");
  });

  it("does not award first-open accordion credit in a presentation", async () => {
    const accordion = blockSchema.parse({ id: "accordion", type: "accordion", version: 1, data: { items: [{ id: "one", title: "First section", body: "Read the explanation" }, { id: "two", title: "Second section", body: "Second explanation" }] } });
    await render(course([accordion]));
    expect(circle()).toBe("Lesson 0% complete");
    expect(saved!.interactedContentIds).not.toContain("accordion:section:one");
    await act(async () => [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.includes("First section"))!.click()); await settle();
    expect(saved!.lessonScrollProgress.first).toBe(50);
  });

  it("awards process-step progress on navigation rather than first display", async () => {
    const steps = blockSchema.parse({ id: "steps", type: "processSteps", version: 1, data: { steps: [{ id: "one", title: "First step", body: "Read the explanation" }, { id: "two", title: "Second step", body: "Another explanation" }] } });
    await render(course([steps]));
    expect(circle()).toBe("Lesson 0% complete");
    const button = [...container.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent === "Next step")!;
    expect(button).toBeDefined();
    await act(async () => button.click()); await settle();
    expect(saved!.lessonScrollProgress.first).toBe(100);
    expect(next().disabled).toBe(false);
  });
});
