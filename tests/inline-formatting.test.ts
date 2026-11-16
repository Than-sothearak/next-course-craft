/** @vitest-environment jsdom */

import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { hasInlineCodeTerms, hasInlineFormatting, highlightInlineCodeTermsInHtml, inlineFormattingHtml, stripInlineFormatting } from "../lib/editor/inline-formatting";
import { richTextEditorExtensions } from "../app/courses/[courseId]/edit/_components/(editor_client_components)/(text_editing_components)/text-formatting-toolbar";

describe("generated inline emphasis", () => {
  it("escapes text while converting the supported bold and highlight markers", () => {
    expect(inlineFormattingHtml("Use **care** and ==focus== < safely."))
      .toBe('Use <strong>care</strong> and <span data-generated-emphasis="true" style="background-color: #fef08a">focus</span> &lt; safely.');
    expect(stripInlineFormatting("Use **care** and ==focus==.")).toBe("Use care and focus.");
  });

  it("renders single and double backtick terms as padded theme highlights without bolding them", () => {
    const source = "Use `photosynthesis` and ``cause and effect`` < carefully.";

    expect(inlineFormattingHtml(source)).toBe(
      'Use <span data-generated-emphasis="true" style="background-color: #fef08a">photosynthesis</span> and <span data-generated-emphasis="true" style="background-color: #fef08a">cause and effect</span> &lt; carefully.',
    );
    expect(stripInlineFormatting(source)).toBe("Use photosynthesis and cause and effect < carefully.");
    expect(hasInlineFormatting(source)).toBe(true);
    expect(hasInlineCodeTerms(source)).toBe(true);
  });

  it("formats backtick terms in saved HTML while leaving code blocks untouched", () => {
    const html = '<p>Use `a &amp; b` in an explanation.</p><pre><code>`raw code`</code></pre>';

    expect(highlightInlineCodeTermsInHtml(html)).toBe(
      '<p>Use <span data-generated-emphasis="true" style="background-color: #fef08a">a &amp; b</span> in an explanation.</p><pre><code>`raw code`</code></pre>',
    );
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

  it("keeps generated backtick highlights at normal weight through the Tiptap round trip", () => {
    const editor = new Editor({
      extensions: richTextEditorExtensions,
      content: `<p>${inlineFormattingHtml("Remember `the key idea`.")}</p>`,
    });
    try {
      const html = editor.getHTML();
      expect(html).not.toContain("<strong>");
      expect(html).toContain('data-generated-emphasis="true"');
      expect(html).toContain("background-color: rgb(254, 240, 138)");
      expect(editor.getText()).toBe("Remember the key idea.");
    } finally {
      editor.destroy();
    }
  });
});
