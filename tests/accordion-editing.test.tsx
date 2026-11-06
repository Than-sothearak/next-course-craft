/** @vitest-environment jsdom */
import { act, useState } from "react";
import type { Editor } from "@tiptap/core";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContentBlockEditor } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/content-block-editor";
import { accordionBlockSchema, type ContentBlock } from "@/lib/schemas/block";
import { parseScorm12Snapshot } from "@/lib/scorm12/snapshot";
import { getHandoutBlockText } from "@/lib/pdf/content";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const initial = (layout: "accordion" | "tabs") => accordionBlockSchema.parse({ id: "accordion", version: 1, type: "accordion", data: { layout, items: [{ id: "one", title: "First section", body: "First explanation" }, { id: "two", title: "Second section", body: "Second explanation" }] } });

describe("direct accordion text formatting", () => {
  let root: Root; let container: HTMLDivElement; let saved: ContentBlock;
  beforeEach(() => {
    Object.defineProperty(Range.prototype, "getClientRects", { configurable: true, value: () => [] });
    Object.defineProperty(Range.prototype, "getBoundingClientRect", { configurable: true, value: () => new DOMRect() });
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); delete (Range.prototype as unknown as Record<string, unknown>).getClientRects; delete (Range.prototype as unknown as Record<string, unknown>).getBoundingClientRect; });
  const editor = (field: "title" | "explanation", index = 1) => container.querySelector<HTMLElement & { editor: Editor }>(`[contenteditable="true"][aria-label="Edit accordion section ${index} ${field}"]`)!;

  it.each(["accordion", "tabs"] as const)("edits %s titles and bodies on the block and exports their formatting", async (layout) => {
    function Authoring() {
      const [block, setBlock] = useState<ContentBlock>(initial(layout));
      saved = block;
      return <ContentBlockEditor block={block} courseId="course" onChange={setBlock} />;
    }
    await act(async () => root.render(<Authoring />));
    const title = editor("title");
    act(() => { title.focus(); title.editor.commands.setContent("<p>Updated section</p>"); title.editor.commands.setTextSelection({ from: 1, to: 8 }); });
    expect(container.querySelector("button [contenteditable='true']")).toBeNull();
    await act(async () => document.querySelector<HTMLButtonElement>('[data-text-selection-popup] [aria-label="Bold"]')!.click());
    const body = editor("explanation");
    act(() => { body.focus(); body.editor.commands.setContent("<p>Updated explanation</p><p>Another paragraph</p>"); body.editor.commands.selectAll(); });
    await act(async () => document.querySelector<HTMLButtonElement>('[data-text-selection-popup] [aria-label="Italic"]')!.click());
    const parsed = accordionBlockSchema.parse(saved);
    expect(parsed.data.items[0]).toMatchObject({ title: "Updated section", body: "Updated explanation\n\nAnother paragraph", titleHtml: expect.stringContaining("<strong>Updated</strong>"), bodyHtml: expect.stringContaining("<em>") });
    expect(parsed.data.items[1]).toEqual(initial(layout).data.items[1]);
    const exported = parseScorm12Snapshot({ title: "Accordion", description: "", revision: 1, sections: [{ id: "s", title: "Section", order: 0 }], lessons: [{ id: "l", sectionId: "s", title: "Lesson", order: 0, blocks: [JSON.parse(JSON.stringify(parsed))] }] }).lessons[0].blocks[0];
    expect(exported).toEqual(parsed);
    expect(getHandoutBlockText(exported)).toEqual(["Updated section", "Updated explanation\nAnother paragraph", "Second section", "Second explanation"]);
    act(() => title.editor.commands.setContent(`<p>${"x".repeat(161)}</p>`));
    expect(accordionBlockSchema.parse(saved).data.items[0].title).toBe("Updated section");
  });

  it("updates formatted content when the plain settings fields are edited", async () => {
    function Authoring() {
      const [block, setBlock] = useState<ContentBlock>(accordionBlockSchema.parse({ ...initial("accordion"), data: { ...initial("accordion").data, items: initial("accordion").data.items.map((item) => ({ ...item, titleHtml: `<p><strong>${item.title}</strong></p>`, bodyHtml: `<p><em>${item.body}</em></p>` })) } }));
      saved = block;
      return <ContentBlockEditor block={block} courseId="course" onChange={setBlock} inlineSettings />;
    }
    await act(async () => root.render(<Authoring />));
    const input = container.querySelector<HTMLInputElement>('[aria-label="Reveal section 1 title"]')!;
    act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "Plain settings title"); input.dispatchEvent(new Event("input", { bubbles: true })); });
    expect(accordionBlockSchema.parse(saved).data.items[0]).toMatchObject({ title: "Plain settings title", bodyHtml: "<p><em>First explanation</em></p>" });
    expect(accordionBlockSchema.parse(saved).data.items[0].titleHtml).toBeUndefined();
  });

  it("shows a popup only for selected text, preserves formatting actions and dismisses it on caret, Escape and outside click", async () => {
    function Authoring() {
      const [block, setBlock] = useState<ContentBlock>(initial("accordion"));
      return <ContentBlockEditor block={block} courseId="course" onChange={setBlock} />;
    }
    await act(async () => root.render(<Authoring />));
    const title = editor("title");
    act(() => title.focus());
    expect(document.querySelector("[data-text-selection-popup]")).toBeNull();
    act(() => title.editor.commands.setTextSelection({ from: 1, to: 6 }));
    const popup = document.querySelector<HTMLDivElement>("[data-text-selection-popup]")!;
    expect(popup.parentElement).toBe(document.body);
    expect(popup.getAttribute("role")).toBe("dialog");
    await act(async () => popup.querySelector<HTMLButtonElement>('[aria-label="Bold"]')!.click());
    expect(title.querySelector("strong")?.textContent).toBe("First");
    expect(document.querySelector("[data-text-selection-popup]")).not.toBeNull();
    act(() => title.editor.commands.setTextSelection(3));
    expect(document.querySelector("[data-text-selection-popup]")).toBeNull();
    act(() => title.editor.commands.setTextSelection({ from: 1, to: 7 }));
    act(() => title.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })));
    expect(document.querySelector("[data-text-selection-popup]")).toBeNull();
    act(() => title.editor.commands.setTextSelection({ from: 1, to: 8 }));
    act(() => document.body.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true })));
    expect(document.querySelector("[data-text-selection-popup]")).toBeNull();
    const body = editor("explanation");
    act(() => { body.focus(); body.editor.commands.selectAll(); });
    expect(document.querySelectorAll("[data-text-selection-popup]")).toHaveLength(1);
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Collapse section 1"]')!.click());
    expect(document.querySelector("[data-text-selection-popup]")).toBeNull();
  });

  it("positions the popup beside the active endpoint of a multiline selection within the viewport", async () => {
    function Authoring() {
      const [block, setBlock] = useState<ContentBlock>(initial("accordion"));
      return <ContentBlockEditor block={block} courseId="course" onChange={setBlock} />;
    }
    await act(async () => root.render(<Authoring />));
    const body = editor("explanation");
    vi.spyOn(body.editor.view, "coordsAtPos").mockReturnValue({ left: 200, right: 200, top: 620, bottom: 640 });
    act(() => {
      body.focus();
      body.editor.commands.setContent("<p>First line</p><p>Second line</p><p>Last line</p>");
      body.editor.commands.selectAll();
    });

    const popup = document.querySelector<HTMLElement>("[data-text-selection-popup]")!;
    expect(popup.style.left).toBe("200px");
    expect(popup.style.top).toBe("332px");
    expect(Number.parseFloat(popup.style.maxHeight)).toBeLessThanOrEqual(window.innerHeight - 16);
  });

  it("keeps the popup and selected range when focusing font controls and typing a custom size", async () => {
    function Authoring() {
      const [block, setBlock] = useState<ContentBlock>(initial("accordion"));
      saved = block;
      return <ContentBlockEditor block={block} courseId="course" onChange={setBlock} />;
    }
    await act(async () => root.render(<Authoring />));
    const title = editor("title");
    act(() => { title.focus(); title.editor.commands.setTextSelection({ from: 1, to: 6 }); });
    const control = <T extends HTMLElement,>(label: string) => document.querySelector<T>(`[data-text-selection-popup] [aria-label="${label}"]`)!;
    const family = control<HTMLSelectElement>("Font family");
    // Real clicks may flush microtasks after blur, before the control receives
    // focus. Programmatic focus() alone does not exercise that event ordering.
    await act(async () => {
      family.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
      title.blur();
    });
    expect(family.isConnected).toBe(true);
    await act(async () => family.focus());
    expect(document.activeElement).toBe(family);
    expect(family.isConnected).toBe(true);
    act(() => { family.value = "battambang"; family.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(document.activeElement).toBe(family);
    expect(title.querySelector('[data-font-family="battambang"]')?.textContent).toBe("First");

    const size = control<HTMLInputElement>("Custom font size in pixels");
    await act(async () => size.focus());
    expect(size.isConnected).toBe(true);
    for (const value of ["", "3", "32"]) {
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(size, value);
        size.dispatchEvent(new Event("input", { bubbles: true }));
      });
      expect(document.activeElement).toBe(size);
      expect(size.isConnected).toBe(true);
    }
    expect(title.querySelector('[style*="font-size: 32px"]')?.textContent).toBe("First");
    expect(title.editor.state.selection).toMatchObject({ from: 1, to: 6 });
    expect(accordionBlockSchema.parse(saved).data.items[0].title).toBe("First section");

    const preset = control<HTMLSelectElement>("Font size preset");
    await act(async () => preset.focus());
    act(() => { preset.value = "24px"; preset.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(title.querySelector('[style*="font-size: 24px"]')?.textContent).toBe("First");
    await act(async () => family.focus());
    act(() => { family.value = ""; family.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(title.querySelector('[data-font-family]')).toBeNull();
    expect(title.querySelector('[style*="font-size: 24px"]')?.textContent).toBe("First");
    expect(document.querySelector("[data-text-selection-popup]")).not.toBeNull();
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Collapse section 1"]')!.focus());
    expect(document.querySelector("[data-text-selection-popup]")).toBeNull();
  });
});
