import type { Editor } from "@tiptap/core";

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

