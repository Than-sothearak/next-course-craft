/** @vitest-environment jsdom */

import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { hasInlineFormatting, inlineFormattingInHtml, inlineFormattingHtml, stripInlineFormatting } from "../lib/editor/inline-formatting";
import { richTextEditorExtensions } from "../app/courses/[courseId]/edit/_components/(editor_client_components)/(text_editing_components)/text-formatting-toolbar";

describe("generated inline emphasis", () => {
  it("preserves literal HTML and nested marker characters inside inline code", () => {
    expect(inlineFormattingHtml('Use `<p>Welcome.</p>` and ``const message = `hello`;`` with **bold**.'))
      .toBe('Use <code>&lt;p&gt;Welcome.&lt;/p&gt;</code> and <code>const message = `hello`;</code> with <strong>bold</strong>.');
    expect(inlineFormattingHtml('`**literal** ==code==`')).toBe('<code>**literal** ==code==</code>');
    expect(inlineFormattingHtml('***<p>Welcome.</p>***')).toBe('<code>&lt;p&gt;Welcome.&lt;/p&gt;</code>');
  });
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

  it("renders single and double backticks as inline code", () => {
    const source = "Use `photosynthesis` and ``cause and effect`` < carefully.";

    expect(inlineFormattingHtml(source)).toBe(
      'Use <code>photosynthesis</code> and <code>cause and effect</code> &lt; carefully.',
    );
    expect(stripInlineFormatting(source)).toBe("Use photosynthesis and cause and effect < carefully.");
    expect(hasInlineFormatting(source)).toBe(true);
  });

  it("formats inline code in saved HTML without changing raw code blocks", () => {
    const html = '<p>Use `a &amp; b` in an explanation.</p><pre><code>`raw code`</code></pre>';

    expect(inlineFormattingInHtml(html)).toBe('<p>Use <code>a &amp; b</code> in an explanation.</p><pre><code>`raw code`</code></pre>');
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

  it("preserves inline code through the Tiptap round trip", () => {
    const editor = new Editor({
      extensions: richTextEditorExtensions,
      content: `<p>${inlineFormattingHtml("Remember `the key idea`.")}</p>`,
    });
    try {
      const html = editor.getHTML();
      expect(html).not.toContain("<strong>");
      expect(html).not.toContain('data-generated-emphasis="true"');
      expect(html).not.toContain("background-color");
      expect(html).toContain("<code>the key idea</code>");
      expect(editor.getText()).toBe("Remember the key idea.");
    } finally {
      editor.destroy();
    }
  });
});
