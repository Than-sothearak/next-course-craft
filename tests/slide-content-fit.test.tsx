/** @vitest-environment jsdom */
/* eslint-disable @next/next/no-img-element -- Simulates image loading in the shared static learner runtime. */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fitSlideContent } from "@/lib/editor/slide-content-fit";
import { SlideObjectContent } from "@/app/courses/[courseId]/_components/slide-presentation/slide-object-content";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("presentation content fitting", () => {
  it.each([
    [{ width: 600, height: 300 }, { width: 600, height: 1200 }, 0.25],
    [{ width: 300, height: 300 }, { width: 600, height: 300 }, 0.5],
    [{ width: 600, height: 300 }, { width: 200, height: 100 }, 1],
  ])("fits the complete content without stretching or enlarging it", (viewport, content, expectedScale) => {
    const fit = fitSlideContent(viewport, content);
    expect(fit.scale).toBe(expectedScale);
    expect(fit.left).toBeGreaterThanOrEqual(0);
    expect(fit.top).toBeGreaterThanOrEqual(0);
    expect(fit.left + content.width * fit.scale).toBeLessThanOrEqual(viewport.width);
    expect(fit.top + content.height * fit.scale).toBeLessThanOrEqual(viewport.height);
  });

  it("waits for hidden or unmeasured blocks before fitting", () => {
    expect(fitSlideContent({ width: 0, height: 300 }, { width: 600, height: 1200 })).toEqual({ scale: 1, left: 0, top: 0 });
  });

  let container: HTMLDivElement;
  let root: Root;
  let viewport: { width: number; height: number };
  let content: { width: number; height: number };
  let resizeCallbacks: ResizeObserverCallback[];
  let frames: Map<number, FrameRequestCallback>;
  let frameId: number;
  let disconnect: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    viewport = { width: 600, height: 300 };
    content = { width: 600, height: 1200 };
    resizeCallbacks = []; frames = new Map(); frameId = 0;
    disconnect = vi.fn();
    vi.stubGlobal("ResizeObserver", class {
      constructor(callback: ResizeObserverCallback) { resizeCallbacks.push(callback); }
      observe() {}
      disconnect = disconnect;
    });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.set(++frameId, callback); return frameId; });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => { frames.delete(id); });
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(function (this: HTMLElement) { return this.hasAttribute("data-slide-object-content") || this.hasAttribute("data-slide-content-body") ? viewport.width : 0; });
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(function (this: HTMLElement) { return this.hasAttribute("data-slide-object-content") || this.hasAttribute("data-slide-content-body") ? viewport.height : 0; });
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(function (this: HTMLElement) { return this.hasAttribute("data-slide-content-body") ? content.width : 0; });
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(function (this: HTMLElement) { return this.hasAttribute("data-slide-content-body") ? content.height : 0; });
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals();
  });
  async function flushFrames() {
    await act(async () => {
      const pending = [...frames.values()]; frames.clear(); pending.forEach((callback) => callback(0));
    });
  }
  const scale = () => Number(container.querySelector('[data-slide-object-content]')?.getAttribute("data-content-scale"));

  it("fits dense content and recomputes when the author resizes its box", async () => {
    await act(async () => root.render(<SlideObjectContent><div>Thirty flip cards</div></SlideObjectContent>));
    expect(scale()).toBe(0.25);
    expect(container.querySelector<HTMLElement>("[data-slide-content-body]")?.style.left).toBe("225px");
    viewport.height = 600;
    act(() => resizeCallbacks.forEach((callback) => callback([], {} as ResizeObserver)));
    await flushFrames();
    expect(scale()).toBe(0.5);
    viewport = { width: 200, height: 200 };
    act(() => resizeCallbacks.forEach((callback) => callback([], {} as ResizeObserver)));
    await flushFrames();
    expect(scale()).toBeCloseTo(1 / 6);
  });

  it("remeasures added and expanded content, and restores full size when the content shrinks", async () => {
    content.height = 200;
    await act(async () => root.render(<SlideObjectContent><div>Closed accordion</div></SlideObjectContent>));
    expect(scale()).toBe(1);
    content.height = 900;
    await act(async () => root.render(<SlideObjectContent><div>Expanded accordion with more content</div></SlideObjectContent>));
    await flushFrames();
    expect(scale()).toBeCloseTo(1 / 3);
    content.height = 100;
    await act(async () => root.render(<SlideObjectContent><div>Closed accordion</div></SlideObjectContent>));
    await flushFrames();
    expect(scale()).toBe(1);
  });

  it("updates after late image loads and stops measuring after unmount", async () => {
    await act(async () => root.render(<SlideObjectContent><img alt="Flip card answer" src="/answer.png" /></SlideObjectContent>));
    content.height = 1800;
    await act(async () => container.querySelector("img")!.dispatchEvent(new Event("load")));
    await flushFrames();
    expect(scale()).toBeCloseTo(1 / 6);
    act(() => root.unmount());
    expect(disconnect).toHaveBeenCalled();
    expect(frames.size).toBe(0);
    root = createRoot(container);
  });

  it("keeps media in the existing frame without changing its aspect-ratio sizing", async () => {
    await act(async () => root.render(<SlideObjectContent media><video src="/portrait.webm" /></SlideObjectContent>));
    expect(scale()).toBe(1);
    expect(container.querySelector<HTMLElement>("[data-slide-content-body]")?.style.transform).toBe("");
    expect(resizeCallbacks).toHaveLength(0);
  });
});
