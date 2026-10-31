/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudioInstruction } from "@/app/courses/[courseId]/_components/slide-presentation/audio-instruction";
import { SlidePlaybackContext } from "@/app/courses/[courseId]/_components/slide-presentation/slide-playback-context";
import { audioInstructionBlockSchema } from "@/lib/schemas/block";
import { slideMediaRestartEvent } from "@/lib/editor/slide-playback";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const block = audioInstructionBlockSchema.parse({ id: "instructions", type: "audioInstruction", version: 1, data: { src: "/api/assets/aaaaaaaaaaaaaaaaaaaaaaaa/file", autoPlay: true } });
describe("audio instruction playback", () => {
  let root: Root; let container: HTMLDivElement; let play: ReturnType<typeof vi.spyOn>; let pause: ReturnType<typeof vi.spyOn>; let paused: WeakMap<HTMLMediaElement, boolean>;
  beforeEach(() => {
    paused = new WeakMap();
    vi.spyOn(HTMLMediaElement.prototype, "paused", "get").mockImplementation(function (this: HTMLMediaElement) { return paused.get(this) ?? true; });
    play = vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) { paused.set(this, false); this.dispatchEvent(new Event("play")); return Promise.resolve(); });
    pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (this: HTMLMediaElement) { paused.set(this, true); this.dispatchEvent(new Event("pause")); });
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); });
  const render = (next = block, active = true, authoring = false, onEnded = vi.fn()) => act(async () => root.render(<SlidePlaybackContext.Provider value={active}><AudioInstruction key={next.data.src} block={next} authoring={authoring} onEnded={onEnded} /></SlidePlaybackContext.Provider>));
  it("autoplays only active learner audio, stops on leaving and restarts through the footer", async () => {
    await render(block, false); expect(play).not.toHaveBeenCalled(); await render(); expect(play).toHaveBeenCalledOnce();
    expect(container.querySelector("button")?.style.backgroundColor).toBe("rgb(248, 250, 252)");
    expect(container.querySelector("button")?.style.color).toBe("rgb(51, 65, 85)");
    const audio = container.querySelector("audio")!; audio.currentTime = 4;
    await act(async () => audio.dispatchEvent(new Event(slideMediaRestartEvent))); expect(audio.currentTime).toBe(0); expect(play).toHaveBeenCalledTimes(2);
    await render(block, false); expect(pause).toHaveBeenCalled(); expect(audio.paused).toBe(true);
  });
  it("does not autoplay in authoring and lets the author preview manually", async () => {
    await render(block, false, true); expect(play).not.toHaveBeenCalled(); await act(async () => container.querySelector<HTMLButtonElement>("button")!.click()); expect(play).toHaveBeenCalledOnce();
    await act(async () => container.querySelector<HTMLButtonElement>("button")!.click()); expect(pause).toHaveBeenCalledOnce();
  });
  it.each([[true, true], [true, false], [false, true], [false, false]])("renders icon=%s and text=%s without exposing native controls", async (showIcon, showText) => {
    await render({ ...block, data: { ...block.data, autoPlay: false, showIcon, showText } });
    expect(Boolean(container.querySelector("button svg"))).toBe(showIcon); expect(container.textContent?.includes(block.data.label)).toBe(showText);
    expect(Boolean(container.querySelector("button"))).toBe(showIcon || showText); expect(container.querySelector("audio")?.controls).toBe(false);
  });
  it("offers manual playback after blocked autoplay and records completion only for learners", async () => {
    play.mockRejectedValueOnce(new DOMException("Blocked", "NotAllowedError")); const end = vi.fn();
    await render(block, true, false, end); expect(container.querySelector("button")?.getAttribute("aria-label")).toBe("Play Audio instructions");
    await act(async () => container.querySelector<HTMLButtonElement>("button")!.click()); expect(container.querySelector("button")?.getAttribute("aria-pressed")).toBe("true");
    await act(async () => container.querySelector("audio")!.dispatchEvent(new Event("ended"))); expect(end).toHaveBeenCalledOnce();
    await render(block, false, true, end); await act(async () => container.querySelector("audio")!.dispatchEvent(new Event("ended"))); expect(end).toHaveBeenCalledOnce();
  });
  it("stops the old audio when replacing its file", async () => {
    await render(); const audio = container.querySelector("audio")!;
    await render({ ...block, data: { ...block.data, src: "/api/assets/bbbbbbbbbbbbbbbbbbbbbbbb/file" } });
    expect(pause.mock.contexts).toContain(audio); expect(container.querySelector("audio")).not.toBe(audio);
  });
});
