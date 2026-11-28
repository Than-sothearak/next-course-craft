/** @vitest-environment jsdom */

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BlockFormatMenu } from "../app/courses/[courseId]/edit/_components/(editor_client_components)/block-format-menu";
import type { ContentBlock } from "../lib/schemas/block";
import { blockSchema } from "../lib/schemas/block";
import { CourseThemeContext } from "../lib/editor/course-theme-context";
import { defaultCourseTheme } from "../lib/editor/theme";
import { blockSurfaceStyle } from "../app/courses/[courseId]/preview/_components/(course_preview_components)/preview-utils";

describe("block format menu", () => {
  it("uses the current course colors for solid and gradient presets with validated learner surfaces", () => {
    const block = blockSchema.parse({ id: "theme-block", type: "richText", version: 1, data: { html: "<p>Text</p>" } });
    const onChange = vi.fn();
    const render = (primaryColor: string, accentColor: string) => act(() => root.render(createElement(CourseThemeContext.Provider, { value: { ...defaultCourseTheme, primaryColor, accentColor } }, createElement(BlockFormatMenu, { block, onChange }))));
    render("#123456", "#abcdef");
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Format block"]')!.click());
    act(() => document.querySelector<HTMLButtonElement>('[aria-label="Use theme brand to accent background"]')!.click());
    const gradient = "linear-gradient(90deg, #123456 0%, #abcdef 100%)";
    const saved = blockSchema.parse(onChange.mock.lastCall?.[0]);
    expect(saved.backgroundColor).toBe(gradient);
    expect(blockSurfaceStyle(saved).backgroundImage).toBe(gradient);
    expect(blockSurfaceStyle(saved).color).toMatch(/^#(?:111827|ffffff)$/);
    render("#24734f", "#f2a65a");
    act(() => document.querySelector<HTMLButtonElement>('[aria-label="Use theme brand background"]')!.click());
    expect(onChange.mock.lastCall?.[0].backgroundColor).toBe("#24734f");
    expect(blockSchema.safeParse({ ...block, backgroundColor: "url(javascript:alert(1))" }).success).toBe(false);
  });
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  });

  it("offers larger block padding values and saves the selected value", () => {
    const block: ContentBlock = {
      id: "text-padding",
      version: 1,
      type: "richText",
      width: "medium",
      widthCustom: false,
      backgroundColor: "#ffffff",
      blockPadding: 20,
      data: { html: "<p>Text</p>" },
    };
    const onChange = vi.fn();

    act(() => root.render(createElement(BlockFormatMenu, { block, onChange })));
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Format block"]')?.click());
    const advanced = document.querySelector<HTMLButtonElement>('[aria-label="Toggle Advanced settings"]')!;
    expect(advanced.getAttribute("aria-expanded")).toBe("false");
    act(() => advanced.click());
    expect(advanced.getAttribute("aria-expanded")).toBe("true");

    const paddingSelect = document.querySelector<HTMLSelectElement>(
      '[aria-label="Block padding"]',
    );
    expect(paddingSelect).not.toBeNull();
    expect(Array.from(paddingSelect?.options ?? [], (option) => option.value)).toEqual([
      "0",
      "20",
      "40",
      "60",
      "80",
      "100",
      "120",
    ]);

    act(() => {
      Object.getOwnPropertyDescriptor(
        window.HTMLSelectElement.prototype,
        "value",
      )?.set?.call(paddingSelect, "80");
      paddingSelect?.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith({ ...block, blockPadding: 80 });
  });

  it("uses presentation sections and keeps collapse and color drafts independent of saved formatting", () => {
    const block: ContentBlock = { id: "format", version: 1, type: "heading", width: "medium", widthCustom: false, backgroundColor: "#ffffff", blockPadding: 60, data: { text: "Title", level: 2 } };
    const onChange = vi.fn();
    const render = (next = block) => act(() => root.render(createElement(BlockFormatMenu, { block: next, onChange })));
    render();
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Format block"]')!.click());
    const panel = document.querySelector('[aria-label="Block format settings"][role="dialog"]')!;
    const click = (label: string) => act(() => panel.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!.click());
    expect([...panel.querySelectorAll('[data-inspector-section]')].map((section) => section.getAttribute("aria-label"))).toEqual(["Layout", "Appearance", "Advanced block format settings"]);
    click("Hide all Block format settings");
    expect([...panel.querySelectorAll<HTMLElement>('[data-inspector-section-content]')].every((section) => section.hidden)).toBe(true);
    click("Show all Block format settings");
    expect([...panel.querySelectorAll<HTMLElement>('[data-inspector-section-content]')].every((section) => !section.hidden)).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
    expect(panel.querySelector('[aria-label="Heading padding"]')).not.toBeNull();
    expect(panel.querySelector('[data-color-picker]')).not.toBeNull();
    expect(panel.querySelector('[aria-label="Choose background color gradient"]')).not.toBeNull();
    const hex = panel.querySelector<HTMLInputElement>('[aria-label="Background color hex code"]')!;
    const input = (value: string) => act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(hex, value);
      hex.dispatchEvent(new Event("input", { bubbles: true }));
    });
    input("#zzzzzz");
    expect(onChange).not.toHaveBeenCalled();
    input("123abc");
    expect(onChange).toHaveBeenLastCalledWith({ ...block, backgroundColor: "#123abc" });
    render({ ...block, backgroundColor: "#aabbcc" });
    expect(hex.value).toBe("#aabbcc");
    act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(panel.getAttribute("data-state")).toBe("closed");
    act(() => vi.advanceTimersByTime(150));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(container.querySelector('[aria-label="Format block"]'));
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
    expect(panel.dataset.state).toBe("closed");
    act(() => vi.advanceTimersByTime(150));
    expect(document.querySelector("#block-format-text-1")).toBeNull();
  });

  it("uses the shared mouse-leave delay and fade while preserving trigger reentry", () => {
    const block = blockSchema.parse({ id: "hover", type: "richText", version: 1, data: { html: "<p>Text</p>" } });
    act(() => root.render(createElement(BlockFormatMenu, { block, onChange: () => {} })));
    const trigger = container.querySelector<HTMLButtonElement>('[aria-label="Format block"]')!;
    act(() => trigger.click());
    const panel = document.querySelector<HTMLElement>("#block-format-hover")!;
    const leave = () => panel.dispatchEvent(Object.assign(new MouseEvent("pointerout", { bubbles: true, relatedTarget: document.body }), { pointerType: "mouse" }));
    act(leave);
    act(() => vi.advanceTimersByTime(200));
    act(() => trigger.dispatchEvent(Object.assign(new MouseEvent("pointerenter"), { pointerType: "mouse" })));
    act(() => vi.advanceTimersByTime(300));
    expect(panel.dataset.state).toBe("open");
    act(leave);
    act(() => vi.advanceTimersByTime(250));
    expect(panel.dataset.state).toBe("closed");
    expect(document.activeElement).toBe(trigger);
    act(() => vi.advanceTimersByTime(150));
    expect(panel.isConnected).toBe(false);
  });
});
