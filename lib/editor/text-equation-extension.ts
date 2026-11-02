import { type Editor, type NodeViewRenderer } from "@tiptap/core";
import { BlockMath, InlineMath } from "@tiptap/extension-mathematics";
import katex from "katex";
import "katex/dist/katex.min.css";
import { equationRenderOptions, equationSourceSchema } from "./text-equation";

export const equationDialogEvent = "course-edit-equation";

export function requestEquationDialog(editor: Editor, pos?: number) {
  if (editor.isDestroyed || !editor.isEditable) return;
  editor.commands.focus();
  editor.view.dom.dispatchEvent(new CustomEvent(equationDialogEvent, { detail: { pos } }));
}

// Store the source in the ordinary math node; generated KaTeX markup is never
// persisted. Both authoring and offline readers render the same bounded source.
function equationNodeView(displayMode: boolean): NodeViewRenderer {
  return ({ node: initialNode, editor, getPos }) => {
    let node = initialNode;
    const dom = document.createElement(displayMode ? "div" : "span");
    dom.contentEditable = "false";
    dom.className = "tiptap-mathematics-render";
    dom.dataset.type = displayMode ? "block-math" : "inline-math";
    if (editor.isEditable) {
      dom.classList.add("tiptap-mathematics-render--editable");
      dom.tabIndex = 0;
      dom.setAttribute("role", "button");
    }
    const render = () => {
      const source = String(node.attrs.latex ?? "");
      dom.dataset.latex = source;
      if (editor.isEditable) dom.setAttribute("aria-label", `Edit equation: ${source}`);
      const parsed = equationSourceSchema.safeParse(source);
      try {
        if (!parsed.success) throw new Error("Invalid equation");
        katex.render(parsed.data, dom, { ...equationRenderOptions, displayMode });
        dom.removeAttribute("data-equation-error");
      } catch {
        dom.textContent = source;
        dom.dataset.equationError = "true";
      }
    };
    const activate = (event: Event) => {
      if (!editor.isEditable) return;
      event.preventDefault();
      event.stopPropagation();
      const pos = getPos();
      if (typeof pos === "number") requestEquationDialog(editor, pos);
    };
    const keydown = (event: Event) => {
      if (!(event instanceof KeyboardEvent)) return;
      if (event.key === "Enter" || event.key === " ") activate(event);
    };
    dom.addEventListener("click", activate);
    dom.addEventListener("keydown", keydown);
    render();
    return {
      dom,
      update(next) {
        if (next.type !== node.type) return false;
        node = next;
        render();
        return true;
      },
      stopEvent: (event) => editor.isEditable && (event.type === "click" || event.type === "keydown"),
      ignoreMutation: () => true,
      destroy() { dom.removeEventListener("click", activate); dom.removeEventListener("keydown", keydown); },
    };
  };
}

export const CourseInlineMath = InlineMath.extend({
  addInputRules: () => [],
  renderText: ({ node }) => String(node.attrs.latex ?? ""),
  addNodeView: () => equationNodeView(false),
});
export const CourseBlockMath = BlockMath.extend({
  addInputRules: () => [],
  renderText: ({ node }) => String(node.attrs.latex ?? ""),
  addNodeView: () => equationNodeView(true),
});
