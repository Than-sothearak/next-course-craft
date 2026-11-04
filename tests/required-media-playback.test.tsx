/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PreviewBlock } from "@/app/courses/[courseId]/preview/_components/(course_preview_components)/(lesson_reader_preview_components)/(lesson_blocks_preview_components)/preview-block";
import { SlidePlaybackContext } from "@/app/courses/[courseId]/_components/slide-presentation/slide-playback-context";
import { blockSchema, type ContentBlock } from "@/lib/schemas/block";
import { finishMediaPlayback, setMediaPlayback } from "./helpers/media-playback";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const cases = [
  ["standard video", "video", false, false],
  ["standard audio", "audio", false, false],
  ["slide video", "video", true, false],
  ["slide audio", "audio", true, false],
  ["cropped video", "video", true, true],
] as const;

describe("required media in shared preview/export blocks", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); });

  it.each(cases)("keeps completion indicators out of the player for %s", async (_name, type, slideLayout, cropped) => {
    const src = "/api/assets/aaaaaaaaaaaaaaaaaaaaaaaa/file";
    const block = blockSchema.parse({ id: "steps", type, version: 1, data: { src, mimeType: type === "video" ? "video/webm" : "audio/mpeg" },
      ...(cropped ? { slideCrop: { source: src, x: 25, y: 0, width: 50, height: 100 }, slideMedia: { source: src, width: 1600, height: 900 } } : {}),
    });
    await act(async () => root.render(<SlidePlaybackContext value><PreviewBlock block={block} device="desktop" orientation="landscape" slideLayout={slideLayout} /></SlidePlaybackContext>));
    const media = container.querySelector<HTMLMediaElement>(type)!;
    const indicator = () => container.querySelector("[data-media-progress]");
    expect(indicator()).toBeNull();
    for (const seconds of [3.9, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40]) {
      setMediaPlayback(media, [[0, seconds]], seconds, 40);
      act(() => media.dispatchEvent(new Event("timeupdate")));
      expect(indicator()).toBeNull();
    }
    act(() => media.dispatchEvent(new Event("ended")));
    expect(indicator()).toBeNull();
  });

  it.each(cases)("blocks timeline skipping and verifies completion for %s", async (_name, type, slideLayout, cropped) => {
    const progress = vi.fn();
    const src = type === "video" ? "/clip.webm" : "/api/assets/aaaaaaaaaaaaaaaaaaaaaaaa/file";
    const block = blockSchema.parse({ id: "media", type, version: 1, slidePlayback: { loop: true }, data: { src, mimeType: type === "video" ? "video/webm" : "audio/mpeg" },
      ...(cropped ? { slideCrop: { source: src, x: 25, y: 0, width: 50, height: 100 }, slideMedia: { source: src, width: 1600, height: 900 } } : {}),
    });
    const render = (content: ContentBlock, completed = false, active = true) => act(async () => root.render(
      <SlidePlaybackContext value={active}><PreviewBlock block={content} device="desktop" orientation="landscape" slideLayout={slideLayout} onInteractiveProgress={progress} interactedContentIds={new Set(completed ? [`media:${type === "video" ? "watched" : "listened"}`] : [])} /></SlidePlaybackContext>,
    ));
    await render(block);
    const media = () => container.querySelector<HTMLMediaElement>(type)!;
    if (slideLayout) expect(media().loop).toBe(false);
    setMediaPlayback(media(), [], 10);
    act(() => media().dispatchEvent(new Event("ended")));
    expect(progress).not.toHaveBeenCalled();
    // Native mouse, touch and keyboard timeline changes all emit seeking.
    for (const event of ["seeking", "seeked"]) {
      setMediaPlayback(media(), [[0, 3]], 9);
      act(() => media().dispatchEvent(new Event(event)));
      expect(media().currentTime).toBe(3);
    }
    media().currentTime = 1;
    act(() => media().dispatchEvent(new Event("seeking")));
    expect(media().currentTime).toBe(1);
    setMediaPlayback(media(), [[0, 3], [9, 10]], 10);
    act(() => media().dispatchEvent(new Event("ended")));
    expect(progress).not.toHaveBeenCalled();
    if (cropped) {
      act(() => media().focus());
      act(() => media().dispatchEvent(new Event("loadedmetadata")));
      const slider = container.querySelector<HTMLInputElement>('[aria-label="Video playback position"]')!;
      act(() => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(slider, "9");
        slider.dispatchEvent(new Event("change", { bubbles: true }));
      });
      expect(media().currentTime).toBe(3);
    }
    act(() => finishMediaPlayback(media()));
    expect(progress).toHaveBeenCalledWith(`media:${type === "video" ? "watched" : "listened"}`);
    if (slideLayout) expect(HTMLMediaElement.prototype.play).toHaveBeenCalledOnce();

    // Restored completion permits review without replaying from zero.
    await render(block, true);
    if (slideLayout) expect(media().loop).toBe(true);
    setMediaPlayback(media(), [], 8);
    act(() => media().dispatchEvent(new Event("seeking")));
    expect(media().currentTime).toBe(8);

    // A replacement source must earn its own playback credit.
    await render({ ...block, data: { ...block.data, src: "/replacement.webm" } } as ContentBlock);
    setMediaPlayback(media(), [], 8);
    act(() => media().dispatchEvent(new Event("seeking")));
    expect(media().currentTime).toBe(0);

    await render({ ...block, requiredForProgress: false });
    setMediaPlayback(media(), [], 8);
    act(() => media().dispatchEvent(new Event("seeking")));
    expect(media().currentTime).toBe(8);

    if (slideLayout) {
      progress.mockClear();
      await render(block, false, false);
      act(() => finishMediaPlayback(media()));
      expect(progress).not.toHaveBeenCalled();
    }
  });
});
