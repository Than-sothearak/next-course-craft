/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResponsiveBlockText } from "../components/responsive-block-text";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("mobile block typography", () => {
  it("scales custom fonts once, preserves small labels and restores desktop sizes", async () => {
    let width = 390;
    const callbacks: ResizeObserverCallback[] = [];
    vi.spyOn(Element.prototype, "clientWidth", "get").mockImplementation(() => width);
    vi.stubGlobal("ResizeObserver", class {
      constructor(callback: ResizeObserverCallback) { callbacks.push(callback); }
      observe() {}
      disconnect() {}
    });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const render = (extra = false, enabled = true) => root.render(
      <ResponsiveBlockText enabled={enabled}>
        <h2 style={{ fontSize: 40 }}>Heading <span style={{ fontSize: 20 }}>Nested</span></h2>
        <p style={{ fontSize: 14 }}>Body</p><small style={{ fontSize: 10 }}>Label</small>
        <ul><li style={{ fontSize: 72 }}><p style={{ fontSize: 72 }}>Large list title</p><p style={{ fontSize: 20 }}>List description</p></li></ul>
        <div data-block-text-role="title"><p data-formatted-title style={{ fontSize: 72 }}>Formatted title</p></div>
        <section data-interactive-block>
          <h3 data-interactive-title style={{ fontSize: 40 }}>Interactive title <span style={{ fontSize: 36 }}>Nested title</span></h3>
          <p data-interactive-body style={{ fontSize: 72 }}>Interactive text <strong style={{ fontSize: 36 }}>Bold body</strong></p>
          <legend data-interactive-question style={{ fontSize: 36 }}>Activity question</legend>
          <small data-interactive-caption style={{ fontSize: 10 }}>Caption</small>
          {extra && <p data-interactive-extra style={{ fontSize: 32 }}>Revealed explanation</p>}
        </section>
        <div data-block-text-canvas><p style={{ fontSize: 40 }}>Slide popup</p></div>
        {extra && <p data-new-explanation style={{ fontSize: 24 }}>New explanation</p>}
      </ResponsiveBlockText>,
    );
    const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 45)); });
    const size = (selector: string) => container.querySelector<HTMLElement>(selector)?.style.getPropertyValue("--block-rendered-font-size");
    try {
      await act(async () => render());
      expect(size("h2")).toBe("22px");
      expect(size("span")).toBe("20px");
      expect(size("[data-formatted-title]")).toBe("22px");
      expect(size("[data-interactive-title]")).toBe("18px");
      expect(size("[data-interactive-title] span")).toBe("18px");
      expect(size("[data-interactive-body]")).toBe("14px");
      expect(size("[data-interactive-body] strong")).toBe("14px");
      expect(size("[data-interactive-question]")).toBe("18px");
      expect(size("[data-interactive-caption]")).toBe("10px");
      expect(size("small")).toBe("10px");
      expect(size("p")).toBe("14px");
      expect(size("li")).toBe("16px");
      expect(size("li p")).toBe("16px");
      expect(size("[data-block-text-canvas] p")).toBe("");
      await act(async () => render(true));
      await settle();
      expect(size("h2")).toBe("22px");
      expect(size("[data-new-explanation]")).toBe("16px");
      expect(size("[data-interactive-extra]")).toBe("14px");
      width = 1000;
      callbacks[0]([], {} as ResizeObserver);
      await settle();
      expect(size("h2")).toBe("");
      expect(container.querySelector("h2")?.style.fontSize).toBe("40px");
      expect(container.querySelector("li")?.style.fontSize).toBe("72px");
      expect(size("[data-interactive-title]")).toBe("");
      expect(container.querySelector<HTMLElement>("[data-interactive-body]")?.style.fontSize).toBe("72px");
      expect(container.querySelector("[data-mobile-block-text]")).toBeNull();
      width = 390;
      callbacks[0]([], {} as ResizeObserver);
      await settle();
      expect(size("h2")).toBe("22px");
      await act(async () => render(true, false));
      expect(size("h2")).toBe("");
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });
});
