/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { SlideSurface } from "@/app/courses/[courseId]/_components/slide-presentation/slide-surface";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("presentation title fitting", () => {
  const originalWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
  const originalScrollWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollWidth");

  afterEach(() => {
    if (originalWidth) Object.defineProperty(HTMLElement.prototype, "clientWidth", originalWidth);
    else delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth;
    if (originalScrollWidth) Object.defineProperty(HTMLElement.prototype, "scrollWidth", originalScrollWidth);
    else delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollWidth;
  });

  it("keeps the entire long title visible on one line and restores its size for a short title", () => {
    Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get() { return this.hasAttribute("data-slide-header") ? 600 : 0; } });
    Object.defineProperty(HTMLElement.prototype, "scrollWidth", { configurable: true, get() {
      if (!this.hasAttribute("data-slide-title-text")) return 0;
      const baseWidth = this.textContent?.startsWith("Long") ? 900 : 240;
      return Math.round(baseWidth * Number.parseFloat(this.style.fontSize) / 32);
    } });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    try {
      const longTitle = "Long presentation title with every word preserved in the preview";
      act(() => root.render(<SlideSurface title={longTitle} titleVisible={false} number={1} total={1} />));
      const title = container.querySelector<HTMLElement>("[data-slide-title-text]")!;
      expect(title.textContent).toBe(longTitle);
      expect(title.classList.contains("whitespace-nowrap")).toBe(true);
      expect(title.style.fontSize).toBe("32px");
      act(() => root.render(<SlideSurface title={longTitle} titleVisible number={1} total={1} />));
      expect(title.scrollWidth).toBeLessThan(container.querySelector<HTMLElement>("[data-slide-header]")!.clientWidth);
      expect(Number.parseFloat(title.style.fontSize)).toBeLessThan(32);
      act(() => root.render(<SlideSurface title="Short title" number={1} total={1} />));
      expect(title.style.fontSize).toBe("32px");
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });
});
