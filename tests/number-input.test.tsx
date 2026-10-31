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
});
