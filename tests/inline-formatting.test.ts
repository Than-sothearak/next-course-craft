/** @vitest-environment jsdom */

import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { hasInlineFormatting, inlineFormattingInHtml, inlineFormattingHtml, stripInlineFormatting } from "../lib/editor/inline-formatting";
import { richTextEditorExtensions } from "../app/courses/[courseId]/edit/_components/(editor_client_components)/(text_editing_components)/text-formatting-toolbar";

describe("generated inline emphasis", () => {
  it("renders triple-asterisk keywords with the padded theme highlight without leaving marker characters", () => {
    const source = "Use ***a < b & c***, **care**, and ==focus==.";

    expect(inlineFormattingHtml(source)).toBe(
      'Use <span data-generated-emphasis="true" style="background-color: #fef08a">a &lt; b &amp; c</span>, <strong>care</strong>, and <span style="background-color: #fef08a">focus</span>.',
    );
    expect(stripInlineFormatting(source)).toBe("Use a < b & c, care, and focus.");
    expect(hasInlineFormatting("***keyword***")).toBe(true);
  });

  it("preserves keyword highlighting at normal weight through the Tiptap editor round trip", () => {
    const editor = new Editor({
      extensions: richTextEditorExtensions,
      content: `<p>${inlineFormattingHtml("Remember ***the key idea***.")}</p>`,
    });
    try {
      expect(editor.getHTML()).toContain('data-generated-emphasis="true"');
      expect(editor.getHTML()).toContain("background-color: rgb(254, 240, 138)");
      expect(editor.getHTML()).not.toMatch(/<(strong|em)>/);
      expect(editor.getText()).toBe("Remember the key idea.");
    } finally {
      editor.destroy();
    }
  });

  it("escapes text while converting the supported bold and highlight markers", () => {
    expect(inlineFormattingHtml("Use **care** and ==focus== < safely."))
      .toBe('Use <strong>care</strong> and <span style="background-color: #fef08a">focus</span> &lt; safely.');
    expect(stripInlineFormatting("Use **care** and ==focus==.")).toBe("Use care and focus.");
  });

  it("does not treat single or double backticks as emphasis markers", () => {
    const source = "Use `photosynthesis` and ``cause and effect`` < carefully.";

    expect(inlineFormattingHtml(source)).toBe(
      'Use `photosynthesis` and ``cause and effect`` &lt; carefully.',
    );
    expect(stripInlineFormatting(source)).toBe(source);
    expect(hasInlineFormatting(source)).toBe(false);
  });

  it("leaves backticks in saved HTML and code blocks unchanged", () => {
    const html = '<p>Use `a &amp; b` in an explanation.</p><pre><code>`raw code`</code></pre>';

    expect(inlineFormattingInHtml(html)).toBe(html);
  });

  it("formats all markers in saved HTML without changing attributes, entities or raw code", () => {
    const html = '<p title="***attribute***">Use ***a &amp; b***, **care**, and ==focus==.</p><pre><code>***raw*** **code** ==value==</code></pre><code>***inline code***</code><!-- **comment** --><p>***last***</p>';
    const formatted = inlineFormattingInHtml(html);

    expect(formatted).toBe('<p title="***attribute***">Use <span data-generated-emphasis="true" style="background-color: #fef08a">a &amp; b</span>, <strong>care</strong>, and <span style="background-color: #fef08a">focus</span>.</p><pre><code>***raw*** **code** ==value==</code></pre><code>***inline code***</code><!-- **comment** --><p><span data-generated-emphasis="true" style="background-color: #fef08a">last</span></p>');
    expect(inlineFormattingInHtml(formatted)).toBe(formatted);
  });

  it("preserves ordinary text highlight formatting without keyword padding through an editor round trip", () => {
    const editor = new Editor({
      extensions: richTextEditorExtensions,
      content: `<p>${inlineFormattingHtml("Use ==focus== now.")}</p>`,
    });
    try {
      const html = editor.getHTML();
      expect(html).not.toContain('data-generated-emphasis="true"');
      expect(html).toContain("background-color: rgb(254, 240, 138)");
      expect(editor.getText()).toBe("Use focus now.");
    } finally {
      editor.destroy();
    }
  });

  it("keeps backtick text as ordinary text through the Tiptap round trip", () => {
    const editor = new Editor({
      extensions: richTextEditorExtensions,
      content: `<p>${inlineFormattingHtml("Remember `the key idea`.")}</p>`,
    });
    try {
      const html = editor.getHTML();
      expect(html).not.toContain("<strong>");
      expect(html).not.toContain('data-generated-emphasis="true"');
      expect(html).not.toContain("background-color");
      expect(editor.getText()).toBe("Remember `the key idea`.");
    } finally {
      editor.destroy();
    }
  });
});
