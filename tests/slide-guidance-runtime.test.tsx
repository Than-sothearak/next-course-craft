/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CoursePreview } from "@/app/courses/[courseId]/preview/course-preview";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { slideCoverInstructionsSchema, type SlideCoverInstructions } from "@/lib/editor/slide-design";
import { guidanceStorageKey, guidanceWasSeen, rememberGuidance } from "@/lib/editor/slide-guidance";
import type { LearnerProgressSnapshot } from "@/lib/export/progress";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const audioSrc = "/api/assets/123456789012345678901234/file";
function course(instructions: Partial<SlideCoverInstructions> = {}, restricted = false) {
  return { courseId: "guided-course", ...editorSnapshotSchema.parse({
    title: "Guided presentation", description: "", revision: 1, courseLayout: "slides", navigationMode: restricted ? "restricted" : "free",
    slideMaster: { navigationGuide: { enabled: true, nextText: "Continue with Next." } },
    sections: [{ id: "section", title: "Slides", order: 0 }],
    lessons: [
      { id: "cover", sectionId: "section", title: "Cover", order: 0, blocks: [], slideCover: { template: "imageCover", instructions: slideCoverInstructionsSchema.parse({ audioSrc, ...instructions }) } },
      { id: "content", sectionId: "section", title: "Lesson", order: 1, blocks: restricted ? [{ id: "question", version: 1, type: "knowledgeCheck", data: { question: "Ready?", options: ["Yes", "No"] } }] : [] },
      { id: "last", sectionId: "section", title: "Last slide", order: 2, blocks: [] },
    ],
  }) };
}

describe("presentation instruction audio and first-visit guidance", () => {
  let root: Root; let container: HTMLDivElement; let play: ReturnType<typeof vi.spyOn>; let pause: ReturnType<typeof vi.spyOn>; let save: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers(); localStorage.clear();
    vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => setTimeout(() => callback(0), 16));
    vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(function (this: HTMLElement) { return this.hasAttribute("data-slide-canvas") ? 540 : 0; });
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(function (this: HTMLElement) { return this.hasAttribute("data-slide-canvas") ? 540 : 0; });
    Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: vi.fn() });
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } });
    Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; } });
    play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(); pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    save = vi.fn(); container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount()); container.remove(); localStorage.clear();
    delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollTo;
    delete (HTMLDialogElement.prototype as unknown as Record<string, unknown>).showModal;
    delete (HTMLDialogElement.prototype as unknown as Record<string, unknown>).close;
    vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers();
  });
  const settle = () => act(async () => vi.advanceTimersByTimeAsync(100));
  const current = () => container.querySelector('[data-slide-canvas][data-slide-active="true"]')!;
  const tip = () => current().querySelector('[role="dialog"][aria-label="Navigation guide"]');
  const click = (text: string, scope: ParentNode = current()) => act(async () => [...scope.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.trim() === text)!.click());
  const active = (id: string) => container.querySelector(`#preview-content-${id}`)?.getAttribute("aria-hidden") === "false";
  async function render(data = course(), standalone = true, key = "first") {
    await act(async () => root.render(<CoursePreview key={key} initialData={data} authorName="" initialLessonId="cover" standalone={standalone} persistLocalProgress={false} progressAdapter={{ load: () => null, save }} />)); await settle();
  }

  it.each([false, true])("keeps Start audio playing across slides and remembers completed notices and tips (standalone=%s)", async (standalone) => {
    const data = course({ audioTrigger: "start", noticeEnabled: true, noticeTitle: "Before you begin" });
    await render(data, standalone);
    expect(container.querySelector("dialog[open]")?.textContent).toContain("Before you begin"); expect(play).not.toHaveBeenCalled();
    await act(async () => container.querySelector("dialog[open]")!.dispatchEvent(new KeyboardEvent("keydown", { key: "PageDown", bubbles: true }))); expect(active("cover")).toBe(true);
    await click("Got it", container.querySelector("dialog[open]")!);
    const audio = container.querySelector<HTMLAudioElement>("[data-presentation-instruction-audio]")!;
    const setAttribute = vi.spyOn(audio, "setAttribute");
    await click("Start"); await settle();
    expect(active("content")).toBe(true); expect(play).toHaveBeenCalledOnce(); expect(pause).not.toHaveBeenCalled();
    expect(container.querySelector("[data-presentation-instruction-audio]")).toBe(audio); expect(audio?.getAttribute("src")).toBe(audioSrc);
    expect(setAttribute.mock.calls.filter(([name]) => name === "src")).toHaveLength(1);
    expect(tip()?.textContent).toContain("Continue with Next.");
    await click("Next tip", tip()!); expect(tip()?.textContent).toContain("Return to a previous slide");
    await click("Next tip", tip()!); expect(tip()?.textContent).toContain("Replay this slide");
    await click("Got it", tip()!); expect(tip()).toBeNull();
    expect(guidanceWasSeen(guidanceStorageKey(data.courseId, "navigation", standalone))).toBe(true);
    await act(async () => current().querySelector<HTMLButtonElement>('[aria-label="Show navigation guide"]')!.click()); expect(tip()).not.toBeNull();
    await click("Skip guide", tip()!);
    await render(data, standalone, "reload"); expect(container.querySelector("dialog[open]")).toBeNull();
    await click("Start"); await settle(); expect(tip()).toBeNull();
  });

  it("offers manual audio playback when the browser blocks cover autoplay", async () => {
    play.mockRejectedValueOnce(new DOMException("Autoplay blocked", "NotAllowedError"));
    await render(course({ audioTrigger: "cover" })); expect(play).toHaveBeenCalledOnce();
    await click("Listen to instructions"); expect(play).toHaveBeenCalledTimes(2);
    await click("Pause instructions"); expect(pause).toHaveBeenCalled();
  });

  it("plays manual audio only when requested and keeps preview guidance separate from the learner export", async () => {
    rememberGuidance(guidanceStorageKey("guided-course", "navigation", false));
    await render(course({ audioTrigger: "manual" })); expect(play).not.toHaveBeenCalled();
    await click("Start"); await settle(); expect(play).not.toHaveBeenCalled(); expect(tip()).not.toBeNull();
  });

  it("holds Start for its configured notice and repeats the notice when first-visit-only is off", async () => {
    await render(course({ audioTrigger: "start", noticeEnabled: true, noticeTrigger: "start", firstVisitOnly: false }));
    expect(container.querySelector("dialog[open]")).toBeNull(); await click("Start");
    expect(active("cover")).toBe(true); expect(play).not.toHaveBeenCalled();
    await click("Start course", container.querySelector("dialog[open]")!); await settle();
    expect(active("content")).toBe(true); expect(play).toHaveBeenCalledOnce();
    await click("Skip guide", tip()!); await click("Previous"); await settle();
    await click("Start"); expect(container.querySelector("dialog[open]")).not.toBeNull();
  });

  it("never unlocks a required activity or fabricates completion when showing or skipping tips", async () => {
    await render(course({}, true)); await click("Start"); await settle();
    const next = () => [...current().querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "Next")!;
    expect(next().disabled).toBe(true); expect(tip()?.textContent).toContain("Complete");
    await click("Next tip", tip()!); await click("Skip guide", tip()!);
    expect(next().disabled).toBe(true); expect(active("content")).toBe(true);
    const snapshot = save.mock.calls.at(-1)![1] as LearnerProgressSnapshot;
    expect(snapshot.interactedContentIds).not.toContain("question:answer"); expect(snapshot.visitedLessonIds).not.toContain("content");
  });

  it("continues to work when browser guidance storage is unavailable", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Blocked"); });
    await render(course({ noticeEnabled: true })); await click("Got it", container.querySelector("dialog[open]")!);
    await click("Start"); await settle(); await click("Skip guide", tip()!); expect(active("content")).toBe(true);
  });
});
