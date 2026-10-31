/** @vitest-environment jsdom */
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ColorPicker, GradientColorContext } from "@/components/ui/color-picker";
import { colorValueSchema } from "@/lib/color";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("shared color picker", () => {
  let container: HTMLDivElement;
  let root: Root;
  let onChange: ReturnType<typeof vi.fn>;
  beforeEach(() => { container = document.createElement("div"); document.body.append(container); root = createRoot(container); onChange = vi.fn(); });
  afterEach(() => { act(() => root.unmount()); container.remove(); });
  function Harness({ gradients = true }: { gradients?: boolean }) { const [color, setColor] = useState("#2563eb"); return <GradientColorContext.Provider value={gradients}><ColorPicker aria-label="Fill color" value={color} onChange={(value) => { onChange(value); setColor(value); }} /><output>{color}</output></GradientColorContext.Provider>; }
  const field = (label: string) => container.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!;
  const input = (label: string, value: string) => act(async () => { const element = field(label); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, value); element.dispatchEvent(new Event("input", { bubbles: true })); });

  it("edits hex codes and both gradient stops with an angle, then returns to solid", async () => {
    await act(async () => root.render(<Harness />));
    await input("Fill color hex code", "#123456"); expect(container.querySelector("output")?.textContent).toBe("#123456");
    const toggle = () => container.querySelector<HTMLButtonElement>('[aria-label="Fill color gradient"]')!;
    await act(async () => toggle().click());
    expect(toggle().getAttribute("aria-pressed")).toBe("true");
    await input("Fill color end hex code", "#abcdef"); await input("Fill color gradient angle", "45");
    expect(container.querySelector("output")?.textContent).toBe("linear-gradient(45deg, #123456 0%, #abcdef 100%)");
    expect(onChange.mock.calls.every(([color]) => colorValueSchema.safeParse(color).success)).toBe(true);
    await act(async () => toggle().click()); expect(container.querySelector("output")?.textContent).toBe("#123456"); expect(field("Fill color end hex code")).toBeNull();
  });

  it("keeps invalid drafts local, restores them on blur, and expands short hex codes on Enter", async () => {
    await act(async () => root.render(<Harness />));
    await input("Fill color hex code", "#zzzzzz"); expect(onChange).not.toHaveBeenCalled(); expect(field("Fill color hex code").getAttribute("aria-invalid")).toBe("true");
    await act(async () => field("Fill color hex code").dispatchEvent(new FocusEvent("focusout", { bubbles: true })));
    expect(field("Fill color hex code").value).toBe("#2563eb");
    await input("Fill color hex code", "#abc");
    await act(async () => field("Fill color hex code").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    expect(container.querySelector("output")?.textContent).toBe("#aabbcc");
  });

  it("keeps standard solid color controls available outside the presentation inspector", async () => {
    await act(async () => root.render(<Harness gradients={false} />));
    expect(container.querySelector('[aria-label="Fill color gradient"]')).toBeNull();
    await input("Fill color", "#ff0000"); expect(container.querySelector("output")?.textContent).toBe("#ff0000");
  });
});
