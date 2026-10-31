/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SlideMediaPlayer } from "@/app/courses/[courseId]/_components/slide-presentation/slide-media-player";
import { SlidePlaybackContext } from "@/app/courses/[courseId]/_components/slide-presentation/slide-playback-context";
import { CoursePreview } from "@/app/courses/[courseId]/preview/course-preview";
import { audioBlockSchema, blockSchema, videoBlockSchema } from "@/lib/schemas/block";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { parseScorm12Snapshot } from "@/lib/scorm12/snapshot";
import { slideMediaRestartEvent } from "@/lib/editor/slide-playback";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const video = videoBlockSchema.parse({ id: "video", version: 1, type: "video", slidePlayback: { autoPlay: true, showControls: false }, data: { src: "/clip.webm", mimeType: "video/webm" } });
const audio = audioBlockSchema.parse({ id: "audio", version: 1, type: "audio", slidePlayback: { autoPlay: true, showControls: false }, data: { src: "/api/assets/123456789012345678901234/file", fileName: "Narration", mimeType: "audio/webm" } });
const snapshot = editorSnapshotSchema.parse({ title: "Presentation", description: "", revision: 1, courseLayout: "slides", navigationMode: "free", sections: [{ id: "section", title: "Slides", order: 0 }], lessons: [
  { id: "first", sectionId: "section", title: "Media", order: 0, blocks: [video, audio] },
  { id: "second", sectionId: "section", title: "Another slide", order: 1, blocks: [{ ...video, id: "other-video" }] },
] });

describe("presentation media playback", () => {
  let container: HTMLDivElement;
  let root: Root;
  let play: ReturnType<typeof vi.spyOn>;
  let pause: ReturnType<typeof vi.spyOn>;
  let paused: WeakMap<HTMLMediaElement, boolean>;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() }));
    vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => setTimeout(() => callback(0), 16));
    vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
    paused = new WeakMap();
    vi.spyOn(HTMLMediaElement.prototype, "paused", "get").mockImplementation(function (this: HTMLMediaElement) { return paused.get(this) ?? true; });
    play = vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) { paused.set(this, false); this.dispatchEvent(new Event("play")); return Promise.resolve(); });
    pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (this: HTMLMediaElement) { paused.set(this, true); this.dispatchEvent(new Event("pause")); });
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
  const media = () => container.querySelector<HTMLMediaElement>("video, audio")!;
  const render = (block: typeof video | typeof audio, active = true, onEnded = vi.fn()) => act(async () => root.render(<SlidePlaybackContext.Provider value={active}><SlideMediaPlayer key={block.data.src} block={block} onEnded={onEnded} /></SlidePlaybackContext.Provider>));
  const pointer = (type: "pointerover" | "pointerout" | "pointerdown", pointerType = "mouse", target: Element = media()) => act(async () => {
    target.dispatchEvent(Object.assign(new MouseEvent(type, { bubbles: true }), { pointerType }));
  });

  it("keeps older defaults and validates/exports playback settings", () => {
    const old = blockSchema.parse({ ...video, slidePlayback: undefined }); expect(old).not.toHaveProperty("slidePlayback.autoPlay");
    expect(blockSchema.parse({ ...video, slidePlayback: {} })).toMatchObject({ slidePlayback: { autoPlay: false, showControls: true } });
    expect(blockSchema.safeParse({ ...video, slidePlayback: { autoPlay: "yes" } }).success).toBe(false);
    expect(blockSchema.safeParse({ ...audio, slidePlayback: { showFileName: "false" } }).success).toBe(false);
    expect(parseScorm12Snapshot(snapshot).lessons[0].blocks).toMatchObject([video, audio]);
  });

  it("hides the audio file name without interrupting playback or changing its accessible name and completion", async () => {
    const end = vi.fn(), shown = audioBlockSchema.parse({ ...audio, slidePlayback: { autoPlay: false, showControls: true } });
    await render(shown, true, end); expect(container.textContent).toContain("Narration");
    const player = media(); await act(async () => player.play()); player.currentTime = 3;
    const hidden = audioBlockSchema.parse({ ...shown, slidePlayback: { ...shown.slidePlayback, showFileName: false } });
    await render(hidden, true, end);
    expect(container.textContent).not.toContain("Narration"); expect(media()).toBe(player); expect(player.getAttribute("aria-label")).toBe("Narration"); expect(player.controls).toBe(true); expect(player.paused).toBe(false); expect(player.currentTime).toBe(3); expect(pause).not.toHaveBeenCalled();
    await act(async () => player.dispatchEvent(new Event("ended"))); expect(end).toHaveBeenCalledOnce();
    await render(shown, true, end); expect(container.textContent).toContain("Narration");
    expect(parseScorm12Snapshot({ ...snapshot, lessons: [{ ...snapshot.lessons[0], blocks: [hidden] }] }).lessons[0].blocks[0]).toMatchObject({ slidePlayback: { showFileName: false }, data: { fileName: "Narration" } });
  });

  it("keeps cropped video controls within the viewport and retains seeking, captions and completion", async () => {
    const cropped = videoBlockSchema.parse({ ...video, slideCrop: { source: video.data.src, x: 25, y: 0, width: 50, height: 100 }, data: { ...video.data, captions: "/captions.vtt" } });
    const end = vi.fn(); await render(cropped, true, end);
    const track = container.querySelector("track")!;
    Object.defineProperty(track, "track", { configurable: true, value: { activeCues: [{ text: "Hello learners" }], mode: "hidden" } });
    Object.defineProperty(media(), "duration", { configurable: true, value: 10 });
    await act(async () => media().dispatchEvent(new Event("loadedmetadata")));
    await pointer("pointerover"); expect(container.querySelector('[data-cropped-video-controls]')).toBeNull();
    await act(async () => media().dispatchEvent(new Event("ended"))); expect(end).toHaveBeenCalledOnce(); expect(media().controls).toBe(false);
    expect(container.querySelector('[data-cropped-video-controls]')).toBeNull();
    await render({ ...cropped, slidePlayback: { autoPlay: false, ...cropped.slidePlayback, showControls: true } }, true, end);
    expect(container.querySelector('[data-cropped-video-controls]')).not.toBeNull();
    const seek = container.querySelector<HTMLInputElement>('[aria-label="Video playback position"]')!;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(seek, "4"); seek.dispatchEvent(new Event("input", { bubbles: true })); }); expect(media().currentTime).toBe(4);
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Mute video"]')!.click()); expect(media().muted).toBe(true);
    // Re-render with a new captions source so the native cue listener attaches to the mocked TextTrack.
    await render({ ...cropped, slidePlayback: { autoPlay: false, ...cropped.slidePlayback, showControls: true }, data: { ...cropped.data, captions: "/other.vtt" } }, true, end);
    await act(async () => { track.dispatchEvent(new Event("cuechange")); container.querySelector<HTMLButtonElement>('[aria-label="Show video captions"]')!.click(); });
    expect(container.querySelector('[data-cropped-video-caption]')?.textContent).toBe("Hello learners");
    await act(async () => media().dispatchEvent(new Event(slideMediaRestartEvent))); expect(media().currentTime).toBe(0); expect(end).toHaveBeenCalledOnce();
  });

  it.each([video, audio])("autoplays only the active slide, hides controls, and pauses when leaving ($type)", async (block) => {
    await render(block, false); expect(play).not.toHaveBeenCalled(); expect(media().controls).toBe(false);
    await render(block, true); expect(play).toHaveBeenCalledTimes(1); expect(media().paused).toBe(false);
    await render(block, false); expect(pause).toHaveBeenCalled(); expect(media().paused).toBe(true);
  });

  it.each([video, audio])("offers a Play button if autoplay is rejected ($type)", async (block) => {
    play.mockRejectedValueOnce(new DOMException("User activation required", "NotAllowedError"));
    await render(block);
    if (block.type === "video") {
      expect(container.querySelector('[aria-label="Play video"]')).toBeNull();
      await pointer("pointerover");
    }
    const button = container.querySelector<HTMLButtonElement>(`[aria-label="Play ${block.type}"]`)!; expect(button).not.toBeNull();
    await act(async () => button.click()); expect(media().paused).toBe(false); expect(media().controls).toBe(false);
    if (block.type === "video") {
      await pointer("pointerout");
      expect(container.querySelector('[aria-label="Pause video"]')).toBeNull();
      expect(media().paused).toBe(false);
    }
  });

  it.each([video, audio])("keeps controls disabled after completion, replay and returning to the slide ($type)", async (block) => {
    const end = vi.fn(); await render(block, true, end);
    await act(async () => media().dispatchEvent(new Event("ended")));
    expect(media().controls).toBe(false);
    if (block.type === "video") await pointer("pointerover");
    expect(end).toHaveBeenCalledTimes(1); expect(media().controls).toBe(false);
    media().currentTime = 8;
    await act(async () => media().dispatchEvent(new Event(slideMediaRestartEvent)));
    expect(media().currentTime).toBe(0); expect(media().controls).toBe(false); expect(end).toHaveBeenCalledTimes(1);
    await render(block, false, end); await render(block, true, end);
    expect(media().controls).toBe(false);
  });

  it.each([video, audio])("applies the controls toggle after completion without restarting playback ($type)", async (block) => {
    const end = vi.fn(); await render(block, true, end);
    await act(async () => media().dispatchEvent(new Event("ended")));
    if (block.type === "video") await pointer("pointerover");
    const player = media(); player.currentTime = 8; const playCount = play.mock.calls.length;
    await render({ ...block, slidePlayback: { autoPlay: false, ...block.slidePlayback, showControls: true } }, true, end);
    expect(media()).toBe(player); expect(player.controls).toBe(true);
    await render(block, true, end);
    expect(player.controls).toBe(false); expect(player.currentTime).toBe(8); expect(play).toHaveBeenCalledTimes(playCount); expect(end).toHaveBeenCalledOnce();
  });

  it("shows video controls on hover and hides them after a mouse click and leave", async () => {
    await render({ ...video, slidePlayback: { autoPlay: false, showControls: true } });
    expect(media().controls).toBe(false);
    await pointer("pointerover");
    expect(media().controls).toBe(true); expect(play).not.toHaveBeenCalled();
    media().currentTime = 8;
    await pointer("pointerdown");
    await act(async () => media().focus());
    await pointer("pointerout");
    expect(document.activeElement).toBe(media());
    expect(media().controls).toBe(false); expect(media().currentTime).toBe(8);
    expect(play).not.toHaveBeenCalled(); expect(pause).not.toHaveBeenCalled();
  });

  it("reveals controls and the hidden-timeline Play button through keyboard focus", async () => {
    await render({ ...video, slidePlayback: { autoPlay: false, showControls: true } });
    await act(async () => media().focus()); expect(media().controls).toBe(true);
    await act(async () => media().blur()); expect(media().controls).toBe(false);
    await render(video);
    await act(async () => media().focus());
    const button = container.querySelector<HTMLButtonElement>('[aria-label="Pause video"]')!;
    expect(button).not.toBeNull();
    await act(async () => button.focus()); expect(container.contains(button)).toBe(true);
    await act(async () => button.blur());
    expect(container.querySelector('[aria-label="Pause video"]')).toBeNull();
  });

  it("reveals video controls on touch and keeps them available after the pointer leaves", async () => {
    await render({ ...video, slidePlayback: { autoPlay: false, showControls: true } });
    expect(media().controls).toBe(false);
    await pointer("pointerdown", "touch");
    await act(async () => media().focus());
    await pointer("pointerout", "touch");
    expect(media().controls).toBe(true);
    await act(async () => media().blur()); expect(media().controls).toBe(false);
  });

  it("keeps audio controls visible without hovering", async () => {
    await render({ ...audio, slidePlayback: { autoPlay: false, showControls: true } });
    expect(media().controls).toBe(true);
    await pointer("pointerover"); await pointer("pointerout");
    expect(media().controls).toBe(true); expect(play).not.toHaveBeenCalled();
  });

  it("restarts only active video/audio from the footer and retains completion progress", async () => {
    const save = vi.fn();
    await act(async () => root.render(<CoursePreview initialData={{ ...snapshot, courseId: "slides" }} initialLessonId="first" authorName="Author" standalone progressAdapter={{ load: () => null, save }} />));
    await act(async () => vi.advanceTimersByTimeAsync(50));
    const first = container.querySelector("#preview-content-first")!;
    const players = [...first.querySelectorAll<HTMLMediaElement>("[data-slide-media-player]")];
    expect(play).toHaveBeenCalledTimes(2);
    for (const player of players) { player.currentTime = 8; await act(async () => player.dispatchEvent(new Event("ended"))); }
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    expect(save.mock.calls.at(-1)![1].interactedContentIds).toEqual(expect.arrayContaining(["video:watched", "audio:listened"]));
    expect(players[0].controls).toBe(false);
    await pointer("pointerover", "mouse", players[0]);
    await act(async () => container.querySelector<HTMLButtonElement>('[data-slide-footer] [aria-label="Restart slide"]')!.click());
    expect(players.every((player) => player.currentTime === 0 && !player.controls)).toBe(true);
    expect(play).toHaveBeenCalledTimes(4);
    expect(container.querySelector<HTMLMediaElement>('#preview-content-second video')?.paused).toBe(true);
    await act(async () => [...container.querySelectorAll<HTMLButtonElement>('[aria-label="Slide navigation"] button')].find((button) => button.textContent?.trim() === "Next")!.click());
    expect(players.every((player) => player.paused)).toBe(true);
    expect(play).toHaveBeenCalledTimes(5);
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    expect(save.mock.calls.at(-1)![1].interactedContentIds).toEqual(expect.arrayContaining(["video:watched", "audio:listened"]));
  });
});
