import type { ChainedCommands, Editor } from "@tiptap/core";

// With a caret, the new text controls format this text object. With selected
// text they affect only that range. Restore the caret after a whole-object edit.
export function formatTextRange(editor: Editor, change: (chain: ChainedCommands) => ChainedCommands, focus = true) {
  const { from, to, empty } = editor.state.selection;
  let chain = editor.chain();
  if (focus) chain = chain.focus();
  if (empty && editor.state.doc.textContent.length) chain = chain.selectAll();
  chain = change(chain);
  if (empty && editor.state.doc.textContent.length) chain = chain.setTextSelection({ from, to });
  return chain.run();
}

export function setInlineStyle(editor: Editor, attribute: "fontSize" | "color" | "highlight", value: string | null) {
  editor.chain().focus().setMark("inlineStyle", { [attribute]: value }).run();
}

export function setFontSize(editor: Editor, fontSize: string | null, focus = true) {
  let chain = editor.chain();
  if (focus) chain = chain.focus();
  chain = chain.setMark("inlineStyle", { fontSize });
  if (editor.isActive("listItem")) chain = chain.updateAttributes("listItem", { fontSize });
  chain.run();
}

