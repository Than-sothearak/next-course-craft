/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudioInstruction } from "@/app/courses/[courseId]/_components/slide-presentation/audio-instruction";
import { SlidePlaybackContext } from "@/app/courses/[courseId]/_components/slide-presentation/slide-playback-context";
import { CoursePreview } from "@/app/courses/[courseId]/preview/course-preview";
import { PreviewBlock } from "@/app/courses/[courseId]/preview/_components/(course_preview_components)/(lesson_reader_preview_components)/(lesson_blocks_preview_components)/preview-block";
import { audioInstructionBlockSchema, interactionButtonBlockSchema } from "@/lib/schemas/block";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { slideMediaRestartEvent } from "@/lib/editor/slide-playback";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const block = audioInstructionBlockSchema.parse({ id: "instructions", version: 1, type: "audioInstruction", data: { src: "/api/assets/aaaaaaaaaaaaaaaaaaaaaaaa/file", autoPlay: true, guide: { enabled: true, title: "Look here", text: "Follow this point while listening." } } });

describe("audio instruction guide playback", () => {
  let root: Root; let container: HTMLDivElement; let play: ReturnType<typeof vi.spyOn>; let pause: ReturnType<typeof vi.spyOn>; let paused: WeakMap<HTMLMediaElement, boolean>;
  beforeEach(() => {
    vi.useFakeTimers(); paused = new WeakMap();
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => setTimeout(() => callback(0), 16));
    vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
    Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: vi.fn() });
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } });
    Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; } });
    vi.spyOn(HTMLMediaElement.prototype, "paused", "get").mockImplementation(function (this: HTMLMediaElement) { return paused.get(this) ?? true; });
    play = vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) { paused.set(this, false); this.dispatchEvent(new Event("play")); return Promise.resolve(); });
    pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (this: HTMLMediaElement) { paused.set(this, true); this.dispatchEvent(new Event("pause")); });
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollTo; delete (HTMLDialogElement.prototype as unknown as Record<string, unknown>).showModal; delete (HTMLDialogElement.prototype as unknown as Record<string, unknown>).close; vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
  const popup = () => container.querySelector<HTMLElement>("[data-audio-guide-popup]");
  const event = (type: string) => act(async () => container.querySelector("audio")!.dispatchEvent(new Event(type)));
  const render = (next = block, active = true, authoring = false, guideEditing = false, onEnded = vi.fn()) => act(async () => root.render(<SlidePlaybackContext.Provider value={active}><div data-slide-canvas style={{ position: "relative", width: 960, height: 540 }}><div data-audio-object style={{ width: 100, height: 40, overflow: "hidden" }}><AudioInstruction key={next.data.src} block={next} presentation authoring={authoring} guideEditing={guideEditing} onGuideChange={vi.fn()} onEnded={onEnded} /></div></div></SlidePlaybackContext.Provider>));
  const timed = (timing: "before" | "with" | "after", delay = 300, effect = "slide-up", duration = 1000) => audioInstructionBlockSchema.parse({ ...block, data: { ...block.data, guide: { ...block.data.guide, timing, animation: { effect, duration, delay } } } });
  const wait = (time: number) => act(async () => vi.advanceTimersByTimeAsync(time));

  it("opens on actual playback outside the clipped block and supports dismissing and reopening without completing audio", async () => {
    const completed = vi.fn(); await render(block, true, false, false, completed);
    expect(play).toHaveBeenCalledOnce(); expect(popup()).toBeNull();
    await event("playing");
    expect(popup()?.textContent).toContain("Follow this point while listening.");
    expect(popup()?.closest("[data-audio-object]")).toBeNull();
    expect(container.querySelector("[data-audio-guide]")?.parentElement).toBe(container.querySelector("[data-slide-canvas]"));
    expect(popup()?.style.left).toBe("55%"); expect(popup()?.style.width).toBe("36%");
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Close audio guide"]')!.click()); expect(popup()).toBeNull();
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Show audio guide: Look here"]')!.click()); expect(popup()).not.toBeNull();
    expect(completed).not.toHaveBeenCalled();
    await event("ended"); expect(popup()).toBeNull(); expect(completed).toHaveBeenCalledOnce();
  });

  it("stays closed when autoplay is blocked, opens after manual playback, and hides on pause or slide exit", async () => {
    play.mockRejectedValueOnce(new DOMException("Blocked", "NotAllowedError")); await render();
    expect(popup()).toBeNull(); expect(container.querySelector("[data-audio-guide]")).toBeNull();
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Play Audio instructions"]')!.click()); await event("playing"); expect(popup()).not.toBeNull();
    await event("pause"); expect(popup()).toBeNull();
    await event("playing"); expect(popup()).not.toBeNull();
    await render(block, false); expect(popup()).toBeNull(); expect(pause).toHaveBeenCalled();
  });

  it("previews the selected guide in authoring without starting audio and never exposes drag handles to students", async () => {
    await render(block, false, true, true); expect(popup()).not.toBeNull(); expect(play).not.toHaveBeenCalled();
    expect(container.querySelector('[aria-label="Move audio guide point"]')).not.toBeNull(); expect(container.querySelector('[aria-label="Resize audio guide popup"]')).not.toBeNull();
    await render(block, false, true, false); expect(popup()).toBeNull();
    await render(); await event("playing");
    expect(container.querySelector('[aria-label="Move audio guide point"]')).toBeNull(); expect(container.querySelector('[aria-label="Resize audio guide popup"]')).toBeNull();
  });

  it("reopens on Restart, hides on error, and preserves the opt-out for existing instructions", async () => {
    await render(); await event("playing"); await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Close audio guide"]')!.click());
    await event(slideMediaRestartEvent); await event("playing"); expect(popup()).not.toBeNull();
    await event("error"); expect(popup()).toBeNull();
    await render({ ...block, data: { ...block.data, guide: undefined } }); await event("playing"); expect(container.querySelector("[data-audio-guide]")).toBeNull();
  });

  it.each([false, true])("shares canvas placement and audio lifecycle in the course learner (standalone=%s)", async (standalone) => {
    const data = { courseId: "guides", ...editorSnapshotSchema.parse({ title: "Guides", description: "", revision: 1, courseLayout: "slides", navigationMode: "free", sections: [{ id: "section", title: "Slides", order: 0 }], lessons: [
      { id: "first", sectionId: "section", title: "First", order: 0, blocks: [block] }, { id: "second", sectionId: "section", title: "Second", order: 1, blocks: [] },
    ] }) };
    await act(async () => root.render(<CoursePreview initialData={data} authorName="Author" initialLessonId="first" standalone={standalone} persistLocalProgress={false} />));
    await act(async () => vi.advanceTimersByTimeAsync(50)); await event("playing"); expect(popup()).not.toBeNull();
    expect(container.querySelector("[data-audio-guide]")?.parentElement?.getAttribute("data-slide-active")).toBe("true");
    await act(async () => container.querySelector<HTMLButtonElement>('[data-slide-active="true"] button[aria-label="Next"]')!.click());
    expect(popup()).toBeNull(); expect(container.querySelector("#preview-content-second")?.getAttribute("aria-hidden")).toBe("false");
  });

  it("uses the popup mini slide's canvas when narration is nested inside an interaction button", async () => {
    const parent = interactionButtonBlockSchema.parse({ id: "button", version: 1, type: "interactionButton", data: { label: "Open lesson", popup: { blocks: [block] } } });
    await act(async () => root.render(<SlidePlaybackContext.Provider value={true}><div data-slide-canvas><PreviewBlock block={parent} device="desktop" orientation="landscape" slideLayout /></div></SlidePlaybackContext.Provider>));
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Open lesson"]')!.click());
    const audio = document.querySelector("dialog audio")!;
    await act(async () => audio.dispatchEvent(new Event("playing")));
    const guide = document.querySelector("dialog [data-audio-guide]")!;
    expect(guide.parentElement?.hasAttribute("data-interaction-popup-canvas")).toBe(true); expect(guide.querySelector("[data-audio-guide-popup]")?.textContent).toContain("Follow this point while listening.");
  });

  it("shows and animates before audio, then starts narration after the popup delay and entrance duration", async () => {
    await render(timed("before", 300, "zoom", 700)); expect(play).not.toHaveBeenCalled(); expect(popup()).toBeNull();
    await wait(299); expect(popup()).toBeNull(); expect(play).not.toHaveBeenCalled();
    await wait(1); expect(popup()).not.toBeNull(); expect(popup()?.dataset.slideObjectAnimation).toBe("zoom"); expect(play).not.toHaveBeenCalled();
    await wait(699); expect(play).not.toHaveBeenCalled(); await wait(1); expect(play).toHaveBeenCalledOnce();
    await event("playing"); expect(popup()).not.toBeNull(); await event("ended"); expect(popup()).toBeNull();
  });

  it("lets users cancel a before-audio start and restart the full sequence without overlapping narration", async () => {
    await render(timed("before", 300)); await wait(300); expect(popup()).not.toBeNull();
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Pause Audio instructions"]')!.click());
    await wait(2000); expect(play).not.toHaveBeenCalled(); expect(popup()).toBeNull();
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Play Audio instructions"]')!.click()); await wait(1300); expect(play).toHaveBeenCalledOnce();
    await event("playing"); await event(slideMediaRestartEvent); expect(pause).toHaveBeenCalled(); expect(popup()).toBeNull();
    await wait(1299); expect(play).toHaveBeenCalledOnce(); await wait(1); expect(play).toHaveBeenCalledTimes(2);
  });

  it.each(["before", "with"] as const)("ignores queued pause events from Restart in %s mode", async (timing) => {
    pause.mockImplementation(function (this: HTMLMediaElement) {
      paused.set(this, true);
      setTimeout(() => this.dispatchEvent(new Event("pause")), 0);
    });
    await render(timed(timing, 300)); await wait(1300); await event("playing");
    expect(play).toHaveBeenCalledOnce();
    await event(slideMediaRestartEvent); await wait(0); await wait(1300);
    expect(play).toHaveBeenCalledTimes(2); await event("playing"); await wait(300);
    expect(popup()).not.toBeNull();
    expect(container.querySelector('[aria-label="Pause Audio instructions"]')).not.toBeNull();
  });

  it("does not let an older play promise interrupt newer narration", async () => {
    let finishFirst!: () => void;
    play.mockImplementationOnce(function (this: HTMLMediaElement) {
      paused.set(this, false); this.dispatchEvent(new Event("play"));
      return new Promise<void>((resolve) => { finishFirst = resolve; });
    });
    await render(); await event("playing"); await event(slideMediaRestartEvent); await event("playing");
    const stops = pause.mock.calls.length;
    await act(async () => finishFirst());
    expect(pause).toHaveBeenCalledTimes(stops); expect(popup()).not.toBeNull();
  });

  it("keeps a before-audio popup readable after blocked playback and permits immediate manual retry", async () => {
    play.mockRejectedValueOnce(new DOMException("Blocked", "NotAllowedError")); await render(timed("before", 0)); await wait(1000);
    expect(popup()).not.toBeNull(); expect(play).toHaveBeenCalledOnce();
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Play Audio instructions"]')!.click()); expect(play).toHaveBeenCalledTimes(2);
  });

  it("skips the entrance wait for reduced motion or None while retaining the configured popup delay", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    await render(timed("before", 300)); await wait(299); expect(play).not.toHaveBeenCalled(); await wait(1); expect(play).toHaveBeenCalledOnce();
    await act(async () => root.render(<div />)); play.mockClear();
    await render(timed("before", 300, "none")); await wait(300); expect(play).toHaveBeenCalledOnce(); expect(popup()?.dataset.slideObjectAnimation).toBe("none");
  });

  it("opens with audio after one delay and cancels delayed popups when playback ends or pauses", async () => {
    const configured = timed("with", 500); await render(configured); await event("playing");
    await wait(499); expect(popup()).toBeNull(); await wait(1); expect(popup()).not.toBeNull();
    await event("pause"); expect(popup()).toBeNull(); await event("playing"); await wait(200); await event("ended"); await wait(1000); expect(popup()).toBeNull();
    await event("playing"); await wait(200); await event("pause"); await wait(1000); expect(popup()).toBeNull();
  });

  it("shows after audio ends and stays available until dismissed, replayed or exited", async () => {
    const configured = timed("after", 500), completed = vi.fn(); await render(configured, true, false, false, completed); await event("playing"); await wait(1000); expect(popup()).toBeNull();
    await event("ended"); expect(completed).toHaveBeenCalledOnce(); await wait(499); expect(popup()).toBeNull(); await wait(1); expect(popup()).not.toBeNull();
    await event("pause"); expect(popup()).not.toBeNull();
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Close audio guide"]')!.click()); expect(popup()).toBeNull();
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Show audio guide: Look here"]')!.click()); expect(popup()).not.toBeNull();
    await event(slideMediaRestartEvent); expect(popup()).toBeNull(); await event("playing"); await event("ended"); await wait(500); expect(popup()).not.toBeNull();
    await render(configured, false); expect(popup()).toBeNull();
  });

  it.each(["before", "with", "after"] as const)("cancels pending %s timers on slide exit and source replacement", async (timing) => {
    const configured = timed(timing, 500); await render(configured);
    if (timing === "with") await event("playing"); if (timing === "after") await event("ended");
    const before = play.mock.calls.length; await render(configured, false); await wait(2000); expect(popup()).toBeNull(); expect(play).toHaveBeenCalledTimes(before);
    await render(configured); if (timing === "with") await event("playing"); if (timing === "after") await event("ended");
    await render({ ...configured, data: { ...configured.data, src: "/api/assets/bbbbbbbbbbbbbbbbbbbbbbbb/file", autoPlay: false } });
    const replaced = play.mock.calls.length; await wait(2000); expect(popup()).toBeNull(); expect(play).toHaveBeenCalledTimes(replaced);
  });
});
