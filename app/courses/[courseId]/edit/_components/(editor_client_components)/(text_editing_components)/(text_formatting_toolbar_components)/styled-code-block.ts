import { mergeAttributes } from "@tiptap/core";
import CodeBlock from "@tiptap/extension-code-block";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { normalizeCodeLanguage, normalizeCodeTheme } from "@/lib/editor/code-example";
import { highlightCode } from "@/lib/editor/code-highlighting";

const highlightingKey = new PluginKey<DecorationSet>("coursecraftCodeHighlighting");

function decorationsForDocument(doc: ProseMirrorNode) {
  const decorations: Decoration[] = [];
  doc.descendants((node, position) => {
    if (node.type.name !== "codeBlock") return;
    for (const token of highlightCode(node.textContent, node.attrs.language)) {
      decorations.push(Decoration.inline(position + 1 + token.from, position + 1 + token.to, {
        class: `cc-code-token-${token.kind}`,
      }));
    }
    return false;
  });
  return DecorationSet.create(doc, decorations);
}

export const StyledCodeBlock = CodeBlock.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      theme: {
        default: "midnight",
        parseHTML: (element: HTMLElement) => normalizeCodeTheme(element.getAttribute("data-code-theme")),
        rendered: false,
      },
      language: {
        default: "auto",
        parseHTML: (element: HTMLElement) => normalizeCodeLanguage(element.getAttribute("data-code-language")
          ?? element.querySelector("code")?.className.match(/language-([\w-]+)/)?.[1]),
        rendered: false,
      },
    };
  },
  renderHTML({ node, HTMLAttributes }) {
    const language = normalizeCodeLanguage(node.attrs.language);
    return ["pre", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
      "data-code-theme": normalizeCodeTheme(node.attrs.theme),
      "data-code-language": language,
    }), ["code", { class: `language-${language}` }, 0]];
  },
  addProseMirrorPlugins() {
    return [new Plugin<DecorationSet>({
      key: highlightingKey,
      state: {
        init: (_, state) => decorationsForDocument(state.doc),
        apply: (transaction, decorations) => transaction.docChanged
          ? decorationsForDocument(transaction.doc)
          : decorations.map(transaction.mapping, transaction.doc),
      },
      props: { decorations: (state) => highlightingKey.getState(state) },
    })];
  },
}).configure({ enableTabIndentation: true, tabSize: 2 });
