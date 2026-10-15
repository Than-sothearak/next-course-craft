/** @vitest-environment jsdom */
import { Editor } from "@tiptap/core";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { codeExamplePresets, codeExampleSample, renderCodeExampleHtml } from "../lib/editor/code-example";
import { highlightCode } from "../lib/editor/code-highlighting";
import { richTextEditorExtensions } from "../app/courses/[courseId]/edit/_components/(editor_client_components)/(text_editing_components)/text-formatting-toolbar";
import { RichTextBlockEditor } from "../app/courses/[courseId]/edit/_components/(editor_client_components)/(content_block_editor_components)/rich-text-block-editor";
import { blockSchema } from "../lib/schemas/block";
import { parseScorm12Snapshot } from "../lib/scorm12/snapshot";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const editors: Editor[] = [];
function makeEditor(content: string) {
  const editor = new Editor({ extensions: richTextEditorExtensions, content, editable: false });
  editors.push(editor);
  return editor;
}
afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy());
  vi.restoreAllMocks();
});

describe("editable code example templates", () => {
  it.each(codeExamplePresets)("preserves title, explanations, exact code, and $theme style through an editor round trip", (preset) => {
    const sourceCode = 'const message = "<script>មេរៀន</script>";\nconsole.log(message);\n';
    const html = renderCodeExampleHtml({
      title: "Example title", code: sourceCode, explanation: "First explanation paragraph.\n\nSecond paragraph with the result.",
      template: preset.id, language: "javascript",
    });
    const first = makeEditor(html);
    const restored = makeEditor(first.getHTML());
    expect(restored.state.doc.childCount).toBe(4);
    expect(restored.state.doc.firstChild?.textContent).toBe("Example title");
    const code = Array.from({ length: restored.state.doc.childCount }, (_, index) => restored.state.doc.child(index))
      .find((node) => node.type.name === "codeBlock");
    expect(code?.textContent).toBe(sourceCode);
    expect(code?.attrs).toMatchObject({ theme: preset.theme, language: "javascript" });
    expect(restored.getText()).toContain("Second paragraph with the result.");
    expect(restored.view.dom.querySelector("pre .cc-code-token-keyword")?.textContent).toBe("const");
    expect(restored.getHTML()).not.toContain("cc-code-token");
    const codePosition = restored.getHTML().indexOf("<pre");
    const explanationPosition = restored.getHTML().indexOf("First explanation paragraph.");
    expect(preset.explanationPosition === "above" ? explanationPosition < codePosition : explanationPosition > codePosition).toBe(true);

    const snapshot = parseScorm12Snapshot({
      title: "Code lesson", description: "A code example", revision: 0,
      sections: [{ id: "learn", title: "Learn", order: 0 }],
      lessons: [{ id: "example", sectionId: "learn", title: "Example", order: 0, blocks: [
        { id: "code", version: 1, type: "richText", data: { html: restored.getHTML() } },
      ] }],
    });
    expect(snapshot.lessons[0].blocks[0]).toMatchObject({ data: { html: restored.getHTML() } });
  });

  it.each([
    ["html", '<h1 class="title">Hello</h1>', "tag"],
    ["css", ".card { display: flex; gap: 20px; }", "property"],
    ["javascript", 'const greeting = "Hello"; // comment', "keyword"],
  ])("highlights %s without changing source characters", (language, code, kind) => {
    const tokens = highlightCode(code, language);
    expect(tokens.some((token) => token.kind === kind)).toBe(true);
    let offset = 0;
    let reconstructed = "";
    tokens.forEach((token) => {
      expect(token.from).toBeGreaterThanOrEqual(offset);
      reconstructed += code.slice(offset, token.from) + code.slice(token.from, token.to);
      offset = token.to;
    });
    expect(reconstructed + code.slice(offset)).toBe(code);
  });

  it("lets authors change the theme without losing paragraphs or code", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const onChange = vi.fn();
    const block = blockSchema.parse({ id: "example", version: 1, type: "richText", data: {
      html: renderCodeExampleHtml({ ...codeExampleSample, template: "paper-explained-above" }),
    } });
    if (block.type !== "richText") throw new Error("Expected text block");
    try {
      await act(async () => root.render(createElement(RichTextBlockEditor, { block, onChange })));
      const themeSelect = Array.from(container.querySelectorAll("label")).find((label) => label.textContent?.includes("Code theme"))?.querySelector("select");
      expect(themeSelect).toBeDefined();
      await act(async () => {
        themeSelect!.value = "forest";
        themeSelect!.dispatchEvent(new Event("change", { bubbles: true }));
      });
      expect(onChange).toHaveBeenCalled();
      const html = onChange.mock.calls.at(-1)?.[0] as string;
      expect(html).toContain('data-code-theme="forest"');
      expect(html).toContain("<p>The function returns");
      expect(makeEditor(html).view.dom.querySelector("pre code")?.textContent).toBe(codeExampleSample.code);
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });
});
