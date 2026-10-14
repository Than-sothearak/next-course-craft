/** @vitest-environment jsdom */

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BlockFormatMenu } from "../app/courses/[courseId]/edit/_components/block-format-menu";
import type { ContentBlock } from "../lib/schemas/block";

describe("block format menu", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  });

  it("renders above the icon layer and closes outside the format popup", () => {
    const block: ContentBlock = {
      id: "text-1",
      version: 1,
      type: "richText",
      width: "medium",
      widthCustom: false,
      backgroundColor: "#ffffff",
      blockPadding: 20,
      data: { html: "<p>Text</p>" },
    };

    act(() => root.render(createElement(BlockFormatMenu, { block, onChange: () => {} })));
    const trigger = container.querySelector<HTMLButtonElement>('[aria-label="Format block"]')!;
    act(() => trigger.click());
    const panel = document.querySelector<HTMLDivElement>("#block-format-text-1")!;
    expect(panel).not.toBeNull();
    expect(panel.style.position).toBe("fixed");
    expect(panel.style.zIndex).toBe("9999");
    expect(panel.style.right).toBe("24px");
    expect(panel.style.top).toBe("50%");
    expect(panel.style.transform).toBe("translateY(-50%)");

    const dragHandle = panel.querySelector<HTMLDivElement>(
      '[aria-label="Move Block format settings popup"]',
    )!;
    const capturePointer = vi.fn();
    Object.defineProperty(dragHandle, "setPointerCapture", { value: capturePointer });
    Object.defineProperty(dragHandle, "hasPointerCapture", { value: () => false });
    Object.defineProperty(panel, "getBoundingClientRect", {
      value: () => ({
        left: 760,
        top: 150,
        right: 1016,
        bottom: 600,
        width: 256,
        height: 450,
        x: 760,
        y: 150,
        toJSON: () => ({}),
      }),
    });

    function dispatchPointer(type: string, values: Record<string, number>) {
      const event = new Event(type, { bubbles: true });
      Object.assign(event, values);
      act(() => dragHandle.dispatchEvent(event));
    }

    dispatchPointer("pointerdown", { pointerId: 1, button: 0, clientX: 780, clientY: 170 });
    dispatchPointer("pointermove", { pointerId: 1, clientX: 500, clientY: 300 });
    expect(capturePointer).toHaveBeenCalledWith(1);
    expect(panel.style.left).toBe("480px");
    expect(panel.style.top).toBe("280px");

    act(() => document.body.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    expect(document.querySelector("#block-format-text-1")).toBeNull();
  });
});
