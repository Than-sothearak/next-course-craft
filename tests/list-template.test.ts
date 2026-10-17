/** @vitest-environment jsdom */

import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { applyListTemplateToHtml } from "../lib/editor/list-template";
import { richTextEditorExtensions, TextFormattingToolbar } from "../app/courses/[courseId]/edit/_components/(editor_client_components)/(text_editing_components)/text-formatting-toolbar";

describe("list template style changes", () => {
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
      const input = container.querySelector<HTMLInputElement>('input[placeholder="https://example.com"]');
      expect(input).not.toBeNull();
      await act(async () => {
        const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        valueSetter?.call(input, "example.com/guide");
        input?.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await act(async () => {
        container.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
      });

      const document = new DOMParser().parseFromString(editor.getHTML(), "text/html");
      const link = document.querySelector("a");
      expect(link?.getAttribute("href")).toBe("https://example.com/guide");
      expect(link?.textContent).toBe("this source");
      expect(document.body.textContent).toBe("Read this source now.");
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
