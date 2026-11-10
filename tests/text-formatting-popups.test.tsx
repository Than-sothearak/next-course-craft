/** @vitest-environment jsdom */
import { act, useState } from "react";
import type { Editor } from "@tiptap/core";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RichTextBlockEditor } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(content_block_editor_components)/rich-text-block-editor";
import { blockSchema, type ContentBlock } from "@/lib/schemas/block";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
type TextBlock = Extract<ContentBlock, { type: "richText" }>;

describe("selected text formatting popups", () => {
  let root: Root, container: HTMLDivElement, editor: Editor;
  beforeEach(() => {
    vi.spyOn(window, "scrollBy").mockImplementation(() => {});
    Object.defineProperty(Range.prototype, "getClientRects", { configurable: true, value: () => [] });
    Object.defineProperty(Range.prototype, "getBoundingClientRect", { configurable: true, value: () => new DOMRect() });
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount()); container.remove(); vi.restoreAllMocks();
    delete (Range.prototype as unknown as Record<string, unknown>).getClientRects;
    delete (Range.prototype as unknown as Record<string, unknown>).getBoundingClientRect;
  });
  const popup = () => document.querySelector<HTMLElement>("[data-text-selection-popup]")!;
  const panel = () => document.querySelector<HTMLElement>('[data-card-popover][data-state="open"]')!;
  const button = (label: string) => document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
  const position = () => ({ left: popup().style.left, top: popup().style.top });
  async function render(html = "<p>First second third</p>") {
    function Authoring() {
      const [block, setBlock] = useState(() => blockSchema.parse({ id: "text", type: "richText", version: 1, data: { html } }) as TextBlock);
      return <RichTextBlockEditor block={block} onChange={(next) => setBlock({ ...block, data: { html: next } })} />;
    }
    await act(async () => root.render(<Authoring />));
    const field = container.querySelector<HTMLElement & { editor: Editor }>('[contenteditable="true"]')!;
    editor = field.editor;
    vi.spyOn(editor.view, "coordsAtPos").mockReturnValue({ left: 200, right: 200, top: 500, bottom: 520 });
    act(() => { field.focus(); editor.commands.setTextSelection({ from: 1, to: 6 }); });
    return field;
  }
  async function openLink() {
    await act(async () => button(editor.isActive("link") ? "Edit link" : "Add link to selected text").click());
    expect(panel().parentElement).toBe(document.body);
    expect(panel().closest("[data-text-selection-popup]")).toBeNull();
    expect(panel().getAttribute("data-popover-owner")).toBeTruthy();
    const input = panel().querySelector<HTMLInputElement>("input")!;
    expect(document.activeElement).toBe(input);
    return input;
  }
  function inputValue(input: HTMLInputElement, value: string) {
    act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); });
  }

  it("pins the popup while size, font, heading and list formatting reflow the selected text", async () => {
    const field = await render();
    const original = position();
    vi.mocked(editor.view.coordsAtPos).mockReturnValue({ left: 350, right: 350, top: 620, bottom: 640 });
    const size = popup().querySelector<HTMLSelectElement>('[aria-label="Font size preset"]')!;
    act(() => { size.value = "48px"; size.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(position()).toEqual(original);
    const family = popup().querySelector<HTMLSelectElement>('[aria-label="Font family"]')!;
    act(() => { family.value = "serif"; family.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(position()).toEqual(original);
    const style = popup().querySelector<HTMLSelectElement>('[aria-label="Text style"]')!;
    act(() => { style.value = "2"; style.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(position()).toEqual(original);
    act(() => button("Bulleted list").click());
    expect(position()).toEqual(original);
    act(() => field.dispatchEvent(new Event("scroll")));
    expect(position()).toEqual(original);
    act(() => editor.commands.setTextSelection({ from: 4, to: 6 }));
    expect(position().left).toBe("350px");
  });

  it("opens the link panel separately, validates URLs and applies only to the saved selection", async () => {
    await render();
    const original = position();
    const input = await openLink();
    inputValue(input, "javascript:alert(1)");
    act(() => panel().querySelector<HTMLButtonElement>('button[type="submit"]')!.click());
    expect(panel().querySelector('[role="alert"]')).not.toBeNull();
    expect(editor.getHTML()).not.toContain("<a ");
    expect(position()).toEqual(original);
    inputValue(input, "example.com/guide");
    act(() => panel().querySelector<HTMLButtonElement>('button[type="submit"]')!.click());
    expect(editor.view.dom.querySelector("a")?.textContent).toBe("First");
    expect(editor.view.dom.querySelector("a")?.getAttribute("href")).toBe("https://example.com/guide");
    expect(editor.state.selection).toMatchObject({ from: 1, to: 6 });
    expect(position()).toEqual(original);
    expect(panel()).toBeNull();
  });

  it("dismisses only the link panel with Escape or Cancel and retains existing formatting on removal", async () => {
    await render('<p><strong><a href="https://example.com/original">First</a></strong> second third</p>');
    const original = editor.getHTML();
    const input = await openLink();
    inputValue(input, "https://example.com/discard");
    act(() => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })));
    expect(panel()).toBeNull();
    expect(popup()).not.toBeNull();
    expect(editor.getHTML()).toBe(original);
    await openLink();
    act(() => [...panel().querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent === "Cancel")!.click());
    expect(panel()).toBeNull();
    expect(editor.getHTML()).toBe(original);
    await openLink();
    act(() => button("Remove link").click());
    expect(editor.view.dom.querySelector("a")).toBeNull();
    expect(editor.view.dom.querySelector("strong")?.textContent).toBe("First");
    expect(popup()).not.toBeNull();
  });
});
