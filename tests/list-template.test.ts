/** @vitest-environment jsdom */

import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { applyListTemplateToHtml } from "../lib/editor/list-template";
import { richTextEditorExtensions, textEditorExtensions, TextFormattingToolbar } from "../app/courses/[courseId]/edit/_components/(editor_client_components)/(text_editing_components)/text-formatting-toolbar";

describe("list template style changes", () => {
  it.each([
    ["body editor", richTextEditorExtensions],
    ["single object editor", textEditorExtensions],
  ] as const)("keeps a title and supporting text in one item in the %s", (_name, extensions) => {
    const editor = new Editor({
      extensions: [...extensions],
      content: '<ol><li><p><strong>Item title</strong></p></li></ol>',
    });
    const pressEnter = (shiftKey = false) => {
      const event = new KeyboardEvent("keydown", { key: "Enter", shiftKey, bubbles: true, cancelable: true });
      editor.view.dom.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    };

    try {
      let endOfTitle = 0;
      editor.state.doc.descendants((node, position) => {
        if (node.isText) endOfTitle = position + node.nodeSize;
      });
      editor.commands.setTextSelection(endOfTitle);
      pressEnter(true);
      editor.commands.insertContent("Supporting explanation");
      let parsed = new DOMParser().parseFromString(editor.getHTML(), "text/html");
      expect(parsed.querySelectorAll("li")).toHaveLength(1);
      expect([...parsed.querySelectorAll("li > p")].map((node) => node.textContent)).toEqual(["Item title", "Supporting explanation"]);
      expect(parsed.querySelector("li > p:first-child strong")?.textContent).toBe("Item title");
      expect(parsed.querySelector("li > p:last-child strong")).toBeNull();

      pressEnter();
      editor.commands.insertContent("Next title");
      parsed = new DOMParser().parseFromString(editor.getHTML(), "text/html");
      expect(parsed.querySelectorAll("li")).toHaveLength(2);
      expect(parsed.querySelectorAll("li")[1].textContent).toBe("Next title");

      const html = editor.getHTML();
      editor.commands.setContent(html);
      expect(editor.getHTML()).toBe(html);
      const styled = applyListTemplateToHtml(html, '<ul data-list-style="check"><li><p>Placeholder</p></li></ul>');
      const styledDocument = new DOMParser().parseFromString(styled, "text/html");
      expect(styledDocument.querySelectorAll("li")[0].querySelectorAll("p")).toHaveLength(2);
    } finally {
      editor.destroy();
    }
  });

  it("changes bullet markers without replacing authored list text or inline formatting", () => {
    const html = applyListTemplateToHtml(
      '<p>Keep this introduction.</p><ul data-list-style="circle" data-item-spacing="spacious"><li><p><strong>Authored first item</strong></p></li><li><p>Authored second item</p></li></ul>',
      '<ul data-list-style="check"><li><p>Template placeholder</p></li></ul>',
    );
    const document = new DOMParser().parseFromString(html, "text/html");
    const list = document.querySelector("ul");

    expect(document.body.textContent).toContain("Keep this introduction.");
    expect(list?.getAttribute("data-list-style")).toBe("check");
    expect(list?.getAttribute("data-item-spacing")).toBe("spacious");
    expect([...document.querySelectorAll("li")].map((item) => item.textContent)).toEqual([
      "Authored first item",
      "Authored second item",
    ]);
    expect(list?.querySelector("strong")?.textContent).toBe("Authored first item");
    expect(document.body.textContent).not.toContain("Template placeholder");
  });

  it("links only the selected text from the formatting toolbar", async () => {
    Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });
    const editor = new Editor({
      extensions: richTextEditorExtensions,
      content: "<p>Read this source now.</p>",
    });
    let textPosition = 0;
    editor.state.doc.descendants((node, position) => {
      if (node.isText && node.text === "Read this source now.") textPosition = position;
    });
    editor.commands.setTextSelection({ from: textPosition + 5, to: textPosition + 16 });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    try {
      await act(async () => root.render(createElement(TextFormattingToolbar, { editor })));
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[aria-label="Add link to selected text"]')?.click();
      });
      const input = document.querySelector<HTMLInputElement>('[data-card-popover][data-state="open"] input[placeholder="https://example.com"]');
      expect(input).not.toBeNull();
      await act(async () => {
        const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        valueSetter?.call(input, "example.com/guide");
        input?.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await act(async () => {
        document.querySelector<HTMLButtonElement>('[data-card-popover][data-state="open"] button[type="submit"]')?.click();
      });

      const parsedDocument = new DOMParser().parseFromString(editor.getHTML(), "text/html");
      const link = parsedDocument.querySelector("a");
      expect(link?.getAttribute("href")).toBe("https://example.com/guide");
      expect(link?.textContent).toBe("this source");
      expect(parsedDocument.body.textContent).toBe("Read this source now.");
    } finally {
      await act(async () => root.unmount());
      container.remove();
      editor.destroy();
      Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
    }
  });

  it("adds supporting text from the selected list item's toolbar", async () => {
    Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });
    const editor = new Editor({ extensions: richTextEditorExtensions, content: '<ul><li><p><strong>Title</strong></p></li></ul>' });
    editor.commands.setTextSelection(8);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    try {
      await act(async () => root.render(createElement(TextFormattingToolbar, { editor })));
      const button = container.querySelector<HTMLButtonElement>('[aria-label="Text below list title (Shift+Enter)"]');
      expect(button).not.toBeNull();
      await act(async () => { button?.click(); });
      await act(async () => { editor.commands.insertContent("Explanation"); });
      const parsed = new DOMParser().parseFromString(editor.getHTML(), "text/html");
      expect(parsed.querySelectorAll("li")).toHaveLength(1);
      expect([...parsed.querySelectorAll("li > p")].map((node) => node.textContent)).toEqual(["Title", "Explanation"]);
      expect(parsed.querySelector("li > p:last-child strong")).toBeNull();
    } finally {
      await act(async () => root.unmount());
      container.remove();
      editor.destroy();
      Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
    }
  });

  it("updates one selected list spacing preset and serializes it for the preview", async () => {
    Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });
    const editor = new Editor({
      extensions: richTextEditorExtensions,
      content: "<ul><li><p>First</p></li><li><p>Second</p></li></ul><p>Next list</p><ul><li><p>Third</p></li></ul>",
    });
    let textPosition = 0;
    editor.state.doc.descendants((node, position) => {
      if (node.isText && node.text === "First") textPosition = position;
    });
    editor.commands.setTextSelection({ from: textPosition, to: textPosition + 5 });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    try {
      await act(async () => root.render(createElement(TextFormattingToolbar, { editor })));
      const spacingSelect = container.querySelector<HTMLSelectElement>('[aria-label="List item spacing"]');
      expect(spacingSelect).not.toBeNull();
      expect(spacingSelect?.value).toBe("comfortable");

      await act(async () => {
        const valueSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
        valueSetter?.call(spacingSelect, "spacious");
        spacingSelect?.dispatchEvent(new Event("change", { bubbles: true }));
      });

      const renderedLists = new DOMParser().parseFromString(editor.getHTML(), "text/html").querySelectorAll("ul");
      expect(renderedLists).toHaveLength(2);
      expect(renderedLists[0].getAttribute("data-item-spacing")).toBe("spacious");
      expect(renderedLists[1].getAttribute("data-item-spacing")).toBe("comfortable");
    } finally {
      await act(async () => root.unmount());
      container.remove();
      editor.destroy();
      Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
    }
  });

  it("can change bullet lists to numbered styles while keeping their items", () => {
    const html = applyListTemplateToHtml(
      '<ul data-list-style="dash"><li><p>Existing idea</p></li><li><p>Another idea</p></li></ul>',
      '<ol type="I"><li><p>Template step</p></li></ol>',
    );
    const document = new DOMParser().parseFromString(html, "text/html");
    const list = document.querySelector("ol");

    expect(list?.getAttribute("type")).toBe("I");
    expect([...document.querySelectorAll("li")].map((item) => item.textContent)).toEqual([
      "Existing idea",
      "Another idea",
    ]);
    expect(document.querySelector("ul")).toBeNull();
  });
});
