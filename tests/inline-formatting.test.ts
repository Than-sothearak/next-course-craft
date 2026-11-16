/** @vitest-environment jsdom */

import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { inlineFormattingHtml, stripInlineFormatting } from "../lib/editor/inline-formatting";
import { richTextEditorExtensions } from "../app/courses/[courseId]/edit/_components/(editor_client_components)/(text_editing_components)/text-formatting-toolbar";

describe("generated inline emphasis", () => {
  it("escapes text while converting the supported bold and highlight markers", () => {
    expect(inlineFormattingHtml("Use **care** and ==focus== < safely."))
      .toBe('Use <strong>care</strong> and <span data-generated-emphasis="true" style="background-color: #fef08a">focus</span> &lt; safely.');
    expect(stripInlineFormatting("Use **care** and ==focus==.")).toBe("Use care and focus.");
  });

  it("survives the existing Tiptap inline-style editor round trip", () => {
    const editor = new Editor({
      extensions: richTextEditorExtensions,
      content: `<p>${inlineFormattingHtml("Use ==focus== now.")}</p>`,
    });
    try {
      const html = editor.getHTML();
      expect(html).toContain('data-generated-emphasis="true"');
      expect(html).toContain("background-color: rgb(254, 240, 138)");
      expect(editor.getText()).toBe("Use focus now.");
    } finally {
      editor.destroy();
    }
  });
});
