/** @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { act, useState } from "react";
import type { Editor } from "@tiptap/core";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RichTextBlockEditor } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(content_block_editor_components)/rich-text-block-editor";
import { LessonTitleEditor } from "@/app/courses/[courseId]/edit/standard-mode/_components/lesson-title-editor";
import { StatementTextPreview } from "@/app/courses/[courseId]/edit/_components/statement-text-preview";
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
  it("keeps the default lesson title as an H1 in the editor and preview", async () => {
    await act(async () => root.render(<LessonTitleEditor title="Lesson title" onChange={() => {}} onValidityChange={() => {}} />));
    expect(container.querySelector('[role="textbox"] h1')?.textContent).toBe("Lesson title");
    await act(async () => root.render(<StatementTextPreview tag="h1" text="Lesson title" courseTextRole="title" className="text-3xl sm:text-4xl" />));
    expect(container.querySelector('[data-course-text-role="title"] .tiptap h1')?.textContent).toBe("Lesson title");
  });
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
  it("preserves literal inline HTML references beside bullet explanations after editing and preview", async () => {
    const html = '<h3>Paragraph parts</h3><ul><li><p>The opening tag is `&lt;p&gt;`.</p></li><li><p>`&lt;p&gt;Welcome.&lt;/p&gt;` contains the message.</p></li></ul>';
    const assertParts = () => {
      const field = container.querySelector(".lesson-rich-text .tiptap")!;
      expect(field.querySelectorAll("li")).toHaveLength(2);
      expect(Array.from(field.querySelectorAll("code")).map((code) => code.textContent)).toEqual(["<p>", "<p>Welcome.</p>"]);
      expect(field.querySelector("code p")).toBeNull();
    };
    await render(html);
    assertParts();
    const savedHtml = editor.getHTML();
    await act(async () => root.render(<StatementTextPreview tag="p" text="" html={savedHtml} className="" />));
    assertParts();
  });
  it("shows keyword backgrounds, bold and highlights consistently in the editor and preview", async () => {
    const text = "Remember ***keyword***, **bold**, and ==highlight==.";
    const styles = document.createElement("style");
    styles.textContent = readFileSync("app/globals.css", "utf8")
      .match(/\.lesson-rich-text \[data-generated-emphasis="true"\] \{[^}]+\}/)?.[0] ?? "";
    document.head.append(styles);
    const assertFormatting = () => {
      const field = container.querySelector(".lesson-rich-text .tiptap")!;
      expect(field.textContent).toBe("Remember keyword, bold, and highlight.");
      expect(field.querySelector("strong")?.textContent).toBe("bold");
      expect(Array.from(field.querySelectorAll('[data-generated-emphasis="true"]')).map((span) => span.textContent)).toEqual(["keyword"]);
      for (const span of field.querySelectorAll('[data-generated-emphasis="true"]')) {
        expect(getComputedStyle(span).padding).toBe("0.06em 0.2em");
        expect(getComputedStyle(span).backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
      }
      const highlight = Array.from(field.querySelectorAll("span")).find((span) => span.textContent === "highlight")!;
      expect(highlight.hasAttribute("data-generated-emphasis")).toBe(false);
      expect(getComputedStyle(highlight).backgroundColor).toBe("rgb(254, 240, 138)");
      expect(parseFloat(getComputedStyle(highlight).paddingTop || "0")).toBe(0);
      expect(parseFloat(getComputedStyle(highlight).paddingLeft || "0")).toBe(0);
      expect(parseFloat(getComputedStyle(highlight).borderRadius || "0")).toBe(0);
      expect(field.querySelector("em")).toBeNull();
    };

    try {
      await render(`<p>${text}</p>`);
      assertFormatting();
      const savedHtml = editor.getHTML();
      await act(async () => root.render(<StatementTextPreview tag="p" text={text} className="" />));
      assertFormatting();
      await act(async () => root.render(<StatementTextPreview tag="p" text={text} html={savedHtml} className="" />));
      assertFormatting();
    } finally {
      styles.remove();
    }
  });
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

  it("shows inherited heading sizes and updates after heading changes without adding inline formatting", async () => {
    const styles = document.createElement("style");
    styles.textContent = ".tiptap h3 { font-size: 30px; } .tiptap h1 { font-size: 48px; }";
    document.head.append(styles);
    try {
      await render("<h3>First second third</h3>");
      const original = editor.getHTML();
      const size = () => popup().querySelector<HTMLInputElement>('[aria-label="Custom font size in pixels"]')!;
      const preset = () => popup().querySelector<HTMLSelectElement>('[aria-label="Font size preset"]')!;
      expect(size().value).toBe("30");
      expect(preset().value).toBe("30px");
      expect(preset().selectedOptions[0].textContent).toBe("30 px");
      expect(editor.getHTML()).toBe(original);
      const style = popup().querySelector<HTMLSelectElement>('[aria-label="Text style"]')!;
      await act(async () => { style.value = "1"; style.dispatchEvent(new Event("change", { bubbles: true })); });
      await vi.waitFor(() => expect(size().value).toBe("48"));
      expect(preset().value).toBe("48px");
      expect(editor.getHTML()).not.toContain("font-size");
    } finally {
      styles.remove();
    }
  });

  it("shows the exact computed size under a scaled canvas and refreshes on style changes", async () => {
    const styles = document.createElement("style");
    styles.textContent = ".tiptap h3 { font-size: 23.5px; } .updated-size .tiptap h3 { font-size: 26px; }";
    document.head.append(styles);
    try {
      const field = await render("<h3>First second third</h3>");
      const original = editor.getHTML();
      field.parentElement!.style.transform = "scale(0.5)";
      const size = () => popup().querySelector<HTMLInputElement>('[aria-label="Custom font size in pixels"]')!;
      expect(size().value).toBe("23.5");
      expect(popup().querySelector<HTMLSelectElement>('[aria-label="Font size preset"]')!.value).toBe("23.5px");
      await act(async () => { size().focus(); size().blur(); });
      expect(editor.getHTML()).toBe(original);
      await act(async () => { field.parentElement!.classList.add("updated-size"); });
      await vi.waitFor(() => expect(size().value).toBe("26"));
    } finally {
      styles.remove();
    }
  });

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
    expect([...style.options].map((option) => option.value)).toEqual(["paragraph", "1", "2", "3", "4", "5", "6"]);
    act(() => { style.value = "6"; style.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(editor.isActive("heading", { level: 6 })).toBe(true);
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
