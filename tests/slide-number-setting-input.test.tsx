/** @vitest-environment jsdom */
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SlideNumberSettingInput } from "@/app/courses/[courseId]/edit/_components/slide-presentation/slide-number-setting-input";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("slide numeric settings", () => {
  let root: Root;
  let container: HTMLDivElement;
  let saved: number[];
  beforeEach(() => {
    saved = [];
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });

  function Settings() {
    const [size, setSize] = useState(60);
    return <SlideNumberSettingInput aria-label="Title size" min={10} max={120} value={size} onValueChange={(next) => { setSize(next); saved.push(next); }} />;
  }
  function OffsetSettings() {
    const [offset, setOffset] = useState(0);
    return <SlideNumberSettingInput aria-label="Offset" min={-3840} max={3840} step={0.01} value={offset} onValueChange={(next) => { setOffset(next); saved.push(next); }} />;
  }
  function type(value: string) {
    act(() => {
      const field = container.querySelector<HTMLInputElement>("input")!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, value);
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  it("accepts partial digits and saves the completed number", () => {
    act(() => root.render(<Settings />));
    const field = container.querySelector<HTMLInputElement>("input")!;
    act(() => field.focus());
    type("1");
    expect(field.value).toBe("1");
    expect(saved).toEqual([]);
    type("12");
    type("120");
    expect(saved).toEqual([12, 120]);
    act(() => field.blur());
    expect(field.value).toBe("120");
  });

  it("clamps completed out of range values and restores an empty field", () => {
    act(() => root.render(<Settings />));
    const field = container.querySelector<HTMLInputElement>("input")!;
    act(() => field.focus());
    type("500");
    expect(field.value).toBe("500");
    act(() => field.blur());
    expect(saved).toEqual([120]);
    expect(field.value).toBe("120");
    act(() => field.focus());
    type("");
    act(() => field.blur());
    expect(field.value).toBe("120");
  });

  it("accepts a minus sign and decimal offset while typing", () => {
    act(() => root.render(<OffsetSettings />));
    const field = container.querySelector<HTMLInputElement>("input")!;
    act(() => field.focus());
    type("-");
    expect(field.value).toBe("-");
    expect(saved).toEqual([]);
    type("-2");
    type("-20.5");
    expect(saved).toEqual([-2, -20.5]);
    act(() => field.blur());
    expect(field.value).toBe("-20.5");
  });
});
