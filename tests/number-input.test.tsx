/** @vitest-environment jsdom */
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NumberInput } from "@/components/ui/number-input";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
describe("editable numeric fields", () => {
  let root: Root; let container: HTMLDivElement; let changed: ReturnType<typeof vi.fn>;
  beforeEach(() => { changed = vi.fn(); container = document.createElement("div"); document.body.append(container); root = createRoot(container); });
  afterEach(() => { act(() => root.unmount()); container.remove(); });
  function Harness() { const [value, setValue] = useState(80); return <NumberInput aria-label="Size" min={24} max={256} value={value} onValueChange={(next) => { changed(next); setValue(next); }} />; }
  const input = () => container.querySelector("input")!;
  const type = (value: string) => act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input(), value); input().dispatchEvent(new Event("input", { bubbles: true })); });
  async function start() { await act(async () => root.render(<Harness />)); await act(async () => input().focus()); }
  it("allows clearing and typing intermediate numbers below the minimum", async () => {
    await start(); for (const value of ["", "1", "12"]) { await type(value); expect(input().value).toBe(value); }
    expect(changed).not.toHaveBeenCalled(); await type("128"); expect(changed).toHaveBeenLastCalledWith(128);
    await act(async () => input().blur()); expect(input().value).toBe("128");
  });
  it("preserves decimal sizes and commits through Enter", async () => {
    await start(); await type("96.25"); await act(async () => input().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    expect(input().value).toBe("96.25"); expect(changed).toHaveBeenLastCalledWith(96.25); expect(document.activeElement).not.toBe(input());
  });
  it("restores an empty edit and clamps out-of-range input on blur", async () => {
    await start(); await type(""); await act(async () => input().blur()); expect(input().value).toBe("80"); expect(changed).not.toHaveBeenCalled();
    await act(async () => input().focus()); await type("999"); expect(input().value).toBe("999"); expect(changed).not.toHaveBeenCalled();
    await act(async () => input().blur()); expect(input().value).toBe("256"); expect(changed).toHaveBeenLastCalledWith(256);
    await act(async () => input().focus()); await type("1"); await act(async () => input().blur()); expect(input().value).toBe("24");
  });
  it("cancels the edit with Escape", async () => {
    await start(); await type("120"); await type("9"); await act(async () => input().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(input().value).toBe("80"); expect(changed).toHaveBeenLastCalledWith(80); expect(document.activeElement).not.toBe(input());
  });

  it("increments and decrements by one without losing a typed decimal", async () => {
    await start(); await type("96.25");
    const increase = container.querySelector<HTMLButtonElement>('[aria-label="Increase Size by 1"]')!;
    const decrease = container.querySelector<HTMLButtonElement>('[aria-label="Decrease Size by 1"]')!;
    await act(async () => increase.click()); expect(input().value).toBe("97.25");
    await act(async () => decrease.click()); expect(input().value).toBe("96.25");
    await act(async () => input().dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true, shiftKey: true })));
    expect(input().value).toBe("97.25");
    await act(async () => input().dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true })));
    expect(input().value).toBe("96.25");
  });

  it("bounds the step buttons and recovers from empty and unfinished drafts", async () => {
    await start(); await type("");
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Increase Size by 1"]')!.click());
    expect(input().value).toBe("81");
    await type("255.5"); await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Increase Size by 1"]')!.click());
    expect(input().value).toBe("256"); expect(container.querySelector<HTMLButtonElement>('[aria-label="Increase Size by 1"]')!.disabled).toBe(true);
    await type("24"); expect(container.querySelector<HTMLButtonElement>('[aria-label="Decrease Size by 1"]')!.disabled).toBe(true);
    await type("-"); expect(input().value).toBe("-");
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Increase Size by 1"]')!.click()); expect(input().value).toBe("25");
  });

  it.each([{ disabled: true }, { readOnly: true }])("disables both step buttons for %j", async (props) => {
    await act(async () => root.render(<NumberInput aria-label="Size" min={24} max={256} value={80} onValueChange={changed} {...props} />));
    expect([...container.querySelectorAll<HTMLButtonElement>("button")].every((button) => button.disabled)).toBe(true);
    await act(async () => input().dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true })));
    expect(changed).not.toHaveBeenCalled();
  });

  it("updates displayed values after an external change and exposes spinbutton limits", async () => {
    await act(async () => root.render(<NumberInput aria-label="Size" min={24} max={256} value={80} onValueChange={changed} />));
    await act(async () => input().focus()); await type("9");
    await act(async () => root.render(<NumberInput aria-label="Size" min={24} max={256} value={120} onValueChange={changed} />));
    expect(input().value).toBe("120"); expect(input().getAttribute("role")).toBe("spinbutton");
    expect(input().getAttribute("aria-valuemin")).toBe("24"); expect(input().getAttribute("aria-valuemax")).toBe("256");
  });
});
