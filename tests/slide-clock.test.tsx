/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePageClock } from "../components/slides/use-page-clock";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
function Clock({ duration = 5, loop = false }: { duration?: number; loop?: boolean }) {
  const clock = usePageClock(duration, loop);
  return <div><output data-time>{clock.time}</output><output data-playing>{String(clock.playing)}</output><button onClick={clock.toggle}>Toggle</button><button onClick={() => clock.seek(.25)}>Seek</button><button onClick={clock.pause}>Pause</button></div>;
}
describe("coordinated timeline clock", () => {
  let root: Root, container: HTMLDivElement, frames: Map<number, FrameRequestCallback>, nextId: number, now: number;
  beforeEach(() => {
    now = 0; nextId = 0; frames = new Map();
    vi.spyOn(performance, "now").mockImplementation(() => now);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.set(++nextId, callback); return nextId; });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  function click(text: string) { act(() => [...container.querySelectorAll("button")].find((button) => button.textContent === text)!.click()); }
  function frame(time: number) { now = time; const [id, callback] = [...frames.entries()][0]; frames.delete(id); act(() => callback(time)); }
  const time = () => Number(container.querySelector("[data-time]")?.textContent);
  it("uses elapsed browser time, reconstructs after seeking and stops at duration", () => {
    act(() => root.render(<Clock />)); click("Toggle");
    frame(333); expect(time()).toBe(.333); frame(1500); expect(time()).toBe(1.5);
    click("Seek"); frame(1750); expect(time()).toBe(.5);
    frame(10_000); expect(time()).toBe(5); expect(container.querySelector("[data-playing]")?.textContent).toBe("false"); expect(frames.size).toBe(0);
  });
  it("loops preview through the same clock and cancels frames when paused", () => {
    act(() => root.render(<Clock duration={1} loop />)); click("Toggle"); frame(1250); expect(time()).toBe(.25); frame(2900); expect(time()).toBeCloseTo(.9, 5);
    expect(container.querySelector("[data-playing]")?.textContent).toBe("true"); click("Pause"); expect(frames.size).toBe(0);
  });
});
