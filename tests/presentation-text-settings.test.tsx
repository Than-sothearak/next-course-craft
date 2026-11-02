/** @vitest-environment jsdom */
import { Editor } from "@tiptap/core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { richTextEditorExtensions, textEditorExtensions, previewTextEditorExtensions, TextFormattingToolbar } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(text_editing_components)/text-formatting-toolbar";
import { EquationDialog } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(text_editing_components)/equation-dialog";
import { formatTextRange } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(text_editing_components)/(text_formatting_toolbar_components)/text-formatting-commands";
import { equationTemplates, previewEquation } from "@/lib/editor/text-equation";
import { requestEquationDialog } from "@/lib/editor/text-equation-extension";
import { normalizeTextFontFamily } from "@/lib/editor/text-format";
import { appendSlideObjects, readSlideObjectsClipboard, serializeSlideObjects } from "@/lib/editor/slide-clipboard";
import { blockSchema } from "@/lib/schemas/block";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { htmlToHandoutText } from "@/lib/pdf/content";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const editors: Editor[] = [];
function makeEditor(content = "<p>Before after</p>", extensions = richTextEditorExtensions, editable = true) {
  const editor = new Editor({ extensions, content, editable });
  editors.push(editor);
  return editor;
}
afterEach(() => { editors.splice(0).forEach((editor) => editor.destroy()); vi.restoreAllMocks(); });

describe("presentation typography and equation persistence", () => {
  it("formats selected text, or the whole object at a caret, preserving other marks and the caret", () => {
    const editor = makeEditor("<p><strong>Alpha</strong> Beta</p>");
    editor.commands.setTextSelection({ from: 1, to: 6 });
    formatTextRange(editor, (chain) => chain.setMark("inlineStyle", { fontFamily: "battambang" }));
    expect(editor.view.dom.querySelector('[data-font-family="battambang"]')?.textContent).toBe("Alpha");
    expect(editor.view.dom.querySelector("strong")).not.toBeNull();
    expect(editor.getHTML()).not.toContain('Beta</span>');
    editor.commands.setTextSelection(8);
    formatTextRange(editor, (chain) => chain.setMark("inlineStyle", { fontFamily: "nokora" }));
    expect(editor.state.selection.from).toBe(8);
    expect([...editor.view.dom.querySelectorAll('[data-font-family="nokora"]')].map((element) => element.textContent).join("")).toBe("Alpha Beta");
    const restored = makeEditor(editor.getHTML());
    expect(restored.getHTML()).toBe(editor.getHTML());
  });

  it("round-trips superscript/subscript and makes them mutually exclusive", () => {
    const editor = makeEditor("<p>x2 H2O</p>");
    editor.commands.setTextSelection({ from: 2, to: 3 });
    formatTextRange(editor, (chain) => chain.toggleSuperscript());
    expect(editor.getHTML()).toContain("x<sup>2</sup>");
    formatTextRange(editor, (chain) => chain.toggleSubscript());
    expect(editor.getHTML()).toContain("x<sub>2</sub>");
    expect(editor.getHTML()).not.toContain("<sup>");
    expect(makeEditor(editor.getHTML(), previewTextEditorExtensions, false).getHTML()).toBe(editor.getHTML());
  });

  it("accepts bundled font families and rejects arbitrary CSS", () => {
    expect(normalizeTextFontFamily('"Noto Sans Khmer", Arial, Helvetica, sans-serif')).toBe("noto-sans-khmer");
    expect(normalizeTextFontFamily("battambang")).toBe("battambang");
    expect(normalizeTextFontFamily("url(https://example.com/font)")).toBeNull();
    const editor = makeEditor('<p><span style="font-family:evil">Hello</span></p>');
    expect(editor.getHTML()).not.toContain("evil");
  });

  it.each(equationTemplates)("renders the $label template with accessible MathML", ({ source }) => {
    const result = previewEquation(source, true);
    expect(result.error).toBe("");
    expect(result.html).toContain("<math");
    expect(result.html).toContain("katex-html");
  });

  it("bounds invalid or unsafe input and never inserts external images", () => {
    expect(previewEquation("\\frac{").error).not.toBe("");
    expect(previewEquation("").error).toBe("Enter an equation.");
    expect(previewEquation("x".repeat(5001)).error).toContain("5,000");
    expect(previewEquation("\\includegraphics{https://example.com/x.png}").html).not.toContain("<img");
    expect(previewEquation("\\def\\a{\\a}\\a").error).not.toBe("");
  });

  it.each([{ extensions: richTextEditorExtensions }, { extensions: textEditorExtensions }])("keeps inline equations editable through HTML and plain text round trips", ({ extensions }) => {
    const editor = makeEditor('<p>Energy <span data-type="inline-math" data-latex="E=mc^2"></span></p>', extensions);
    expect(editor.getText()).toContain("E=mc^2");
    expect(editor.getHTML()).toContain('data-latex="E=mc^2"');
    expect(editor.getHTML()).not.toContain("katex-html");
    const restored = makeEditor(editor.getHTML(), previewTextEditorExtensions, false);
    expect(restored.view.dom.querySelector("math")).not.toBeNull();
    expect(restored.view.dom.querySelector('[role="button"]')).toBeNull();
    expect(restored.getHTML()).toBe(editor.getHTML());
  });

  it("keeps display equations through snapshot, clipboard, and fresh block duplication", () => {
    const editor = makeEditor('<div data-type="block-math" data-latex="\\frac{a}{b}"></div>');
    const block = blockSchema.parse({ id: "math", version: 1, type: "richText", data: { html: editor.getHTML() } });
    const snapshot = editorSnapshotSchema.parse({ title: "Math", description: "", revision: 0, sections: [{ id: "section", title: "Section", order: 0 }], lessons: [{ id: "slide", sectionId: "section", title: "Slide", order: 0, blocks: [block] }] });
    expect(snapshot.lessons[0].blocks[0]).toMatchObject({ data: { html: editor.getHTML() } });
    const copied = readSlideObjectsClipboard(serializeSlideObjects("course", [block], [block.id], { width: 960, height: 540 }), "course");
    expect(copied).toHaveLength(1);
    const pasted = appendSlideObjects(copied!, [block], () => "fresh-math");
    expect(pasted.blocks[1].id).not.toBe(block.id);
    expect(pasted.blocks[1]).toMatchObject({ data: { html: editor.getHTML() } });
    expect(makeEditor(editor.getHTML(), previewTextEditorExtensions, false).view.dom.querySelector('.katex-display')).not.toBeNull();
  });

  it("falls back to readable source for malformed stored equations", () => {
    const editor = makeEditor('<p><span data-type="inline-math" data-latex="\\frac{"></span></p>', previewTextEditorExtensions, false);
    expect(editor.view.dom.querySelector('[data-equation-error]')?.textContent).toBe("\\frac{");
  });

  it("keeps equation source in PDF text, including comparisons and encoded characters", () => {
    const html = '<p>Given <span data-latex="x > 2 &amp; x &lt; 5" data-type="inline-math"></span>.</p><div data-type="block-math" data-latex="\\frac{1}{2}"></div>';
    expect(htmlToHandoutText(html)).toBe("Given x > 2 & x < 5 .\n\n\\frac{1}{2}");
  });
});

describe("equation dialog", () => {
  let root: Root, container: HTMLDivElement;
  beforeEach(() => {
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } });
    Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; } });
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });
  const button = (name: string) => [...document.body.querySelectorAll<HTMLButtonElement>("button")].find((element) => element.textContent === name)!;
  async function open(editor: Editor, pos?: number) {
    await act(async () => root.render(<><TextFormattingToolbar editor={editor} /><EquationDialog editor={editor} /></>));
    await act(async () => requestEquationDialog(editor, pos));
  }

  it("replaces selected text, commits once, supports undo, and discards a cancelled edit", async () => {
    const editor = makeEditor();
    editor.commands.setTextSelection({ from: 1, to: 7 });
    const updates = vi.fn(); editor.on("update", updates);
    await open(editor);
    expect(button("Insert equation").disabled).toBe(true);
    await act(async () => button("Fraction").click());
    expect(document.querySelector('[data-equation-preview] math')).not.toBeNull();
    await act(async () => button("Insert equation").click());
    expect(editor.getText()).toBe("\\frac{a}{b} after");
    expect(updates).toHaveBeenCalledTimes(1);
    expect(document.querySelector("dialog")).toBeNull();
    const source = editor.getHTML();
    await open(editor, 1);
    await act(async () => button("Root").click());
    await act(async () => button("Cancel").click());
    expect(editor.getHTML()).toBe(source);
    expect(updates).toHaveBeenCalledTimes(1);
    editor.commands.undo();
    expect(editor.getText()).toBe("Before after");
  });

  it("opens existing equations by keyboard and saves without inserting another node", async () => {
    const editor = makeEditor('<p><span data-type="inline-math" data-latex="x^2"></span></p>');
    await act(async () => root.render(<EquationDialog editor={editor} />));
    const math = editor.view.dom.querySelector<HTMLElement>('[data-type="inline-math"]')!;
    await act(async () => math.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    expect(document.querySelector("textarea")?.value).toBe("x^2");
    await act(async () => button("Integral").click());
    await act(async () => button("Save equation").click());
    expect(editor.view.dom.querySelectorAll('[data-type="inline-math"]')).toHaveLength(1);
    expect(editor.getText()).toBe("\\int_{a}^{b} f(x)\\,dx");
  });

  it("limits heading/title equations to inline placement and keeps reset formatting", async () => {
    const editor = makeEditor('<h1><span style="font-family:Battambang, Arial, Helvetica, sans-serif"><sup>Title</sup></span></h1>', textEditorExtensions);
    await open(editor);
    expect(document.querySelector<HTMLOptionElement>('option[value="display"]')?.disabled).toBe(true);
    await act(async () => button("Cancel").click());
    editor.commands.selectAll();
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Reset format"]')!.click());
    expect(editor.getHTML()).toBe("<h1>Title</h1>");
  });
});
