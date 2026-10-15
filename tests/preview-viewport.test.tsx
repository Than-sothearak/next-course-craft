/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { previewFrameSize } from "../app/courses/[courseId]/preview/_components/(course_preview_components)/(preview_viewport_components)/preview-frame-size";
import { PreviewViewport } from "../app/courses/[courseId]/preview/_components/(course_preview_components)/preview-viewport";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("preview viewport sizing", () => {
  it.each([
    ["mobile", "portrait", 390, 844], ["mobile", "landscape", 844, 390],
    ["tablet", "portrait", 768, 1024], ["tablet", "landscape", 1024, 768],
  ] as const)("fits %s/%s to the available area without changing its aspect ratio", (device, orientation, nominalWidth, nominalHeight) => {
    for (const [width, height] of [[1440, 900], [342, 600], [800, 220], [250, 360]]) {
      const size = previewFrameSize(device, orientation, width, height);
      expect(size.width).toBeLessThanOrEqual(width + 0.001);
      expect(size.height).toBeLessThanOrEqual(height + 0.001);
      expect(size.width / size.height).toBeCloseTo(nominalWidth / nominalHeight);
      expect(size.width).toBeLessThanOrEqual(nominalWidth);
    }
  });

  it("uses the full available desktop area and handles unmeasured dimensions", () => {
    expect(previewFrameSize("desktop", "portrait", 390, 640)).toEqual({ width: 390, height: 640 });
    expect(previewFrameSize("mobile", "portrait", 0, 0)).toEqual({ width: 0, height: 0 });
    expect(previewFrameSize("tablet", "landscape", -10, 0)).toEqual({ width: 0, height: 0 });
  });

  it("remeasures after a container resize and uses actual screen width for the compact menu", async () => {
    let width = 1200;
    let height = 1100;
    const observers: { callback: ResizeObserverCallback; disconnect: ReturnType<typeof vi.fn> }[] = [];
    vi.stubGlobal("ResizeObserver", class {
      disconnect = vi.fn();
      observe = vi.fn();
      constructor(callback: ResizeObserverCallback) { observers.push({ callback, disconnect: this.disconnect }); }
    });
    vi.spyOn(Element.prototype, "clientWidth", "get").mockImplementation(function(this: HTMLElement) {
      if (this.hasAttribute("data-preview-screen")) {
        const raw = this.parentElement!.style.width;
        return raw.endsWith("%") ? width : Math.max(0, Number.parseFloat(raw) - 36);
      }
      return width;
    });
    vi.spyOn(Element.prototype, "clientHeight", "get").mockImplementation(() => height);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const compact = vi.fn();
    try {
      await act(async () => root.render(<PreviewViewport device="tablet" orientation="portrait" fontFamily="sans-serif" onCompactChange={compact}><p>Lesson content</p></PreviewViewport>));
      const frame = container.querySelector<HTMLElement>("[data-preview-frame]")!;
      expect(frame.style.width).toBe("768px");
      expect(frame.style.height).toBe("1024px");
      expect(compact).toHaveBeenLastCalledWith(false);
      width = 390;
      height = 800;
      act(() => observers[0].callback([], {} as ResizeObserver));
      expect(frame.style.width).toBe("390px");
      expect(frame.style.height).toBe("520px");
      expect(compact).toHaveBeenLastCalledWith(true);
      await act(async () => root.render(<PreviewViewport device="mobile" orientation="landscape" fontFamily="sans-serif" onCompactChange={compact}><p>Lesson content</p></PreviewViewport>));
      expect(observers[0].disconnect).toHaveBeenCalled();
      expect(Number.parseFloat(frame.style.width)).toBeLessThanOrEqual(390);
    } finally {
      act(() => root.unmount());
      container.remove();
    }
    expect(observers.at(-1)!.disconnect).toHaveBeenCalled();
  });
});
