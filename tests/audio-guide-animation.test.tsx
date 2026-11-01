/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudioInstructionGuide } from "@/app/courses/[courseId]/_components/slide-presentation/audio-instruction-guide";
import { SlidePlaybackContext } from "@/app/courses/[courseId]/_components/slide-presentation/slide-playback-context";
import { audioInstructionGuideSchema } from "@/lib/editor/audio-instruction-guide";
import { replaySlideObjectAnimations } from "@/lib/editor/slide-animation";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const guide = audioInstructionGuideSchema.parse({ enabled: true, animation: { effect: "slide-left", duration: 700, delay: 5000 } });

describe("audio guide popup entrance animation", () => {
  let root: Root; let container: HTMLDivElement; let canvas: HTMLDivElement;
  let previous: PropertyDescriptor | undefined;
  let animations: { element: HTMLElement; frames: Keyframe[]; options: KeyframeAnimationOptions; cancel: ReturnType<typeof vi.fn> }[];
  let reduce: boolean;
  beforeEach(() => {
    reduce = false; animations = []; previous = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "animate");
    vi.stubGlobal("matchMedia", () => ({ matches: reduce, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    Object.defineProperty(HTMLElement.prototype, "animate", { configurable: true, value: function (this: HTMLElement, frames: Keyframe[], options: KeyframeAnimationOptions) { const cancel = vi.fn(); animations.push({ element: this, frames, options, cancel }); return { cancel }; } });
    container = document.createElement("div"); canvas = document.createElement("div"); canvas.dataset.slideCanvas = ""; document.body.append(container, canvas); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); canvas.remove(); if (previous) Object.defineProperty(HTMLElement.prototype, "animate", previous); else delete (HTMLElement.prototype as unknown as Record<string, unknown>).animate; vi.unstubAllGlobals(); });
  const render = (open: boolean, editing = false, next = guide) => act(async () => root.render(<SlidePlaybackContext.Provider value={true}><AudioInstructionGuide id="audio" canvas={canvas} guide={next} open={open} editing={editing} onOpen={vi.fn()} onClose={vi.fn()} onChange={vi.fn()} /></SlidePlaybackContext.Provider>));

  it("animates each opening using the authored effect and duration without applying the audio-event delay twice", async () => {
    await render(false); expect(animations).toHaveLength(0); await render(true);
    expect(animations).toHaveLength(1); expect(animations[0].element.hasAttribute("data-audio-guide-popup")).toBe(true);
    expect(animations[0].frames).toEqual([{ opacity: 0, transform: "translateX(24px)" }, { opacity: 1, transform: "none" }]);
    expect(animations[0].options).toMatchObject({ duration: 700, delay: 0 });
    await render(false); expect(animations[0].cancel).toHaveBeenCalledOnce(); await render(true); expect(animations).toHaveLength(2);
  });

  it("keeps editing still until Preview, then includes the configured popup delay", async () => {
    await render(true, true); expect(animations).toHaveLength(0);
    act(() => replaySlideObjectAnimations(canvas, "audio-guide-audio"));
    expect(animations).toHaveLength(1); expect(animations[0].options).toMatchObject({ duration: 700, delay: 5000 });
    expect(canvas.querySelector<HTMLElement>("[data-audio-guide-popup]")?.style.left).toBe("55%");
  });

  it("honors reduced motion and None for popup animation and manual previews", async () => {
    reduce = true; await render(true); act(() => replaySlideObjectAnimations(canvas)); expect(animations).toHaveLength(0);
    reduce = false; await render(false); await render(true, false, { ...guide, animation: { ...guide.animation, effect: "none" } });
    act(() => replaySlideObjectAnimations(canvas)); expect(animations).toHaveLength(0);
  });
});
