// @vitest-environment jsdom
import { finishMediaPlayback, setMediaPlayback } from "./helpers/media-playback";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CoursePreview, type PreviewData } from "@/app/courses/[courseId]/preview/course-preview";
import { audioBlockSchema, blockSchema, videoBlockSchema } from "@/lib/schemas/block";
import { getInteractiveBlockProgressIds, type LearnerProgressSnapshot } from "@/lib/export/progress";
import { mediaProgressPercent } from "@/lib/export/media-playback";

const audio = audioBlockSchema.parse({ id: "lesson-audio", version: 1, type: "audio", allowSkipping: false, data: {
  src: "/api/assets/507f1f77bcf86cd799439011/file", fileName: "Introduction.mp3", mimeType: "audio/mpeg",
} });
const video = videoBlockSchema.parse({ id: "lesson-video", version: 1, type: "video", allowSkipping: false, data: {
  src: "/api/assets/507f1f77bcf86cd799439012/file", mimeType: "video/mp4",
} });
const mediaCases = [
  { type: "audio", block: audio, progressId: "lesson-audio:listened", standalone: false },
  { type: "audio", block: audio, progressId: "lesson-audio:listened", standalone: true },
  { type: "video", block: video, progressId: "lesson-video:watched", standalone: false },
  { type: "video", block: video, progressId: "lesson-video:watched", standalone: true },
] as const;
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
  it.each(mediaCases)("allows Standard $type skipping by default but waits for the end before unlocking Continue (standalone=$standalone)", async ({ type, block, progressId, standalone }) => {
    const data = course("restricted", true);
    data.lessons[0].blocks[0] = { ...block, allowSkipping: undefined };
    await render(data, standalone);
    const player = container.querySelector<HTMLMediaElement>(type)!;
    setMediaPlayback(player, [[0, 2], [39, 40]], 40, 40);
    act(() => player.dispatchEvent(new Event("seeking")));
    expect(player.currentTime).toBe(40);
    expect(continueButton().disabled).toBe(true);
    act(() => player.dispatchEvent(new Event("ended")));
    await settle();
    expect(snapshot!.interactedContentIds).toContain(progressId);
    expect(continueButton().disabled).toBe(false);
    act(() => continueButton().click());
    await settle();
    expect(secondLesson().disabled).toBe(false);
  });

  it.each(mediaCases)("counts verified Standard $type checkpoints with reading credit (standalone=$standalone)", async ({ type, block, progressId, standalone }) => {
    const data = course("restricted", true);
    data.lessons[0].blocks[0] = block;
    await render(data, standalone);
    const player = container.querySelector<HTMLMediaElement>(type)!;
    // The Continue gate holds reading at 50%, contributing 25% of lesson progress.
    expect(snapshot!.lessonScrollProgress.first).toBe(25);
    for (let step = 1; step <= 10; step++) {
      setMediaPlayback(player, [[0, step * 4]], step * 4, 40);
      act(() => player.dispatchEvent(new Event("timeupdate")));
      await settle();
      const percent = Math.min(90, step * 10);
      expect(mediaProgressPercent(snapshot!.mediaProgress?.[progressId])).toBe(percent);
      expect(snapshot!.lessonScrollProgress.first).toBe(25 + percent / 2);
      expect(container.querySelector(`[aria-label="Lesson ${25 + percent / 2}% complete"]`)).not.toBeNull();
      expect(snapshot!.interactedContentIds).not.toContain(progressId);
      expect(continueButton().disabled).toBe(true);
      expect(secondLesson().disabled).toBe(true);
    }
    act(() => player.dispatchEvent(new Event("ended")));
    await settle();
    expect(snapshot!.interactedContentIds).toContain(progressId);
    expect(continueButton().disabled).toBe(false);
    act(() => continueButton().click());
    await settle();
    expect(snapshot!.lessonScrollProgress.first).toBe(100);
    expect(secondLesson().disabled).toBe(false);
    expect(container.querySelector("[data-media-progress]")).toBeNull();
  });

  it.each(mediaCases)("restores Standard $type checkpoints and blocks skipped coverage (standalone=$standalone)", async ({ type, block, progressId, standalone }) => {
    const data = course();
    data.lessons[0].blocks = [block];
    await render(data, standalone);
    const player = container.querySelector<HTMLMediaElement>(type)!;
    setMediaPlayback(player, [[0, 20]], 20, 40);
    act(() => player.dispatchEvent(new Event("timeupdate")));
    await settle();
    expect(snapshot!.lessonScrollProgress.first).toBe(75);

    act(() => root.unmount()); root = createRoot(container);
    await render(data, standalone);
    const resumed = container.querySelector<HTMLMediaElement>(type)!;
    setMediaPlayback(resumed, [], 0, 40);
    act(() => resumed.dispatchEvent(new Event("loadedmetadata")));
    await settle();
    expect(resumed.currentTime).toBe(20);
    expect(snapshot!.lessonScrollProgress.first).toBe(75);
    setMediaPlayback(resumed, [[20, 24]], 24, 40);
    act(() => resumed.dispatchEvent(new Event("timeupdate")));
    await settle();
    expect(mediaProgressPercent(snapshot!.mediaProgress?.[progressId])).toBe(60);
    expect(snapshot!.lessonScrollProgress.first).toBe(80);
    setMediaPlayback(resumed, [[20, 24], [36, 40]], 40, 40);
    act(() => resumed.dispatchEvent(new Event("seeking")));
    expect(resumed.currentTime).toBe(24);
    act(() => resumed.dispatchEvent(new Event("ended")));
    await settle();
    expect(snapshot!.interactedContentIds).not.toContain(progressId);
    expect(secondLesson().disabled).toBe(true);
  });

  it.each([audio, video])("ignores a saved Standard checkpoint after replacing $type", async (block) => {
    const progressId = `${block.id}:${block.type === "video" ? "watched" : "listened"}`;
    snapshot = { visitedLessonIds: [], lessonScrollProgress: { first: 90 }, revealedDividerIds: [], completedDividerIds: [], selectedLessonId: "first", mediaProgress: {
      [progressId]: { source: "aaaaaaaaaaaaaaaaaaaaaaaa", seconds: 32, duration: 40 },
    } };
    const data = course();
    data.lessons[0].blocks = [block];
    await render(data, true);
    const player = container.querySelector<HTMLMediaElement>(block.type)!;
    setMediaPlayback(player, [], 0, 40);
    act(() => player.dispatchEvent(new Event("loadedmetadata")));
    await settle();
    expect(player.currentTime).toBe(0);
    expect(snapshot!.lessonScrollProgress.first).toBe(50);
    expect(secondLesson().disabled).toBe(true);
  });

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
    setMediaPlayback(player, [[0, 2], [9, 10]], 10);
    act(() => player.dispatchEvent(new Event("ended")));
    await settle();
    expect(snapshot!.interactedContentIds).not.toContain("lesson-audio:listened");
    expect(secondLesson().disabled).toBe(true);
    act(() => finishMediaPlayback(player));
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

  it.each(["free", "sequential"] as const)("requires completed audio for %s lesson completion without restricting navigation", async (mode) => {
    await render(course(mode), true);
    expect(snapshot!.visitedLessonIds).toContain("first");
    expect(snapshot!.interactedContentIds).not.toContain("lesson-audio:listened");
    expect(snapshot!.lessonScrollProgress.first).toBe(50);
    expect(secondLesson().disabled).toBe(false);
    expect(container.querySelector('[aria-label="Course completion"]')?.getAttribute("aria-valuenow")).toBe("0");
    act(() => finishMediaPlayback(container.querySelector("audio")!));
    await settle();
    expect(snapshot!.visitedLessonIds).toContain("first");
    expect(snapshot!.lessonScrollProgress.first).toBe(100);
    expect(secondLesson().disabled).toBe(false);
    expect(container.querySelector('[aria-label="Course completion"]')?.getAttribute("aria-valuenow")).toBe("50");
  });

  it("recalculates legacy reading-only 100% when required audio is still unfinished", async () => {
    snapshot = {
      visitedLessonIds: ["first"],
      lessonScrollProgress: { first: 100 },
      revealedDividerIds: [],
      completedDividerIds: [],
      selectedLessonId: "first",
    };
    await render(course("free"), true);
    expect(snapshot!.lessonScrollProgress.first).toBe(50);
    expect(container.querySelector('[aria-label="Course completion"]')?.getAttribute("aria-valuenow")).toBe("0");
  });

  it.each([false, true])("requires audio above a completion gate, including free navigation (standalone=%s)", async (standalone) => {
    await render(course("free", true), standalone);
    expect(continueButton().disabled).toBe(true);
    act(() => finishMediaPlayback(container.querySelector("audio")!));
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
