import type { Editor } from "@tiptap/core";

/** Read logical CSS pixels, independent of presentation canvas transforms. */
export function selectionFontSize(editor: Editor): number | null {
  if (editor.isDestroyed) return null;
  const { from, to } = editor.state.selection;
  let element: Element | null = null;
  editor.state.doc.nodesBetween(from, to, (node, position) => {
    if (element || !node.isText) return;
    const dom = editor.view.nodeDOM(position);
    element = dom instanceof Element ? dom : dom?.parentElement ?? null;
  });
  if (!element) {
    const { node, offset } = editor.view.domAtPos(from);
    const dom = node.nodeType === Node.TEXT_NODE ? node : node.childNodes[offset] ?? node;
    element = dom instanceof Element ? dom : dom.parentElement;
  }
  if (!element) return null;
  const fontSize = getComputedStyle(element).fontSize;
  if (!fontSize.endsWith("px")) return null;
  const size = Number.parseFloat(fontSize);
  return Number.isFinite(size) && size > 0 ? size : null;
}
