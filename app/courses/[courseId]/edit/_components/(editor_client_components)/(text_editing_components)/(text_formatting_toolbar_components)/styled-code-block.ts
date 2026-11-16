import { mergeAttributes } from "@tiptap/core";
import CodeBlock from "@tiptap/extension-code-block";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { normalizeCodeLanguage, normalizeCodeTheme } from "@/lib/editor/code-example";
import { highlightCode } from "@/lib/editor/code-highlighting";

const highlightingKey = new PluginKey<DecorationSet>("coursecraftCodeHighlighting");

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const field = document.createElement("textarea");
  field.value = value;
  field.setAttribute("readonly", "");
  field.setAttribute("aria-hidden", "true");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.append(field);
  let copied = false;
  try {
    field.select();
    copied = document.execCommand("copy");
  } finally {
    field.remove();
  }
  if (!copied) throw new Error("Clipboard access is unavailable.");
}

function codeCopyButton(code: string) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "cc-code-copy-button";
  button.textContent = "Copy";
  button.setAttribute("aria-label", "Copy code");
  button.setAttribute("contenteditable", "false");
  button.setAttribute("data-code-copy", "true");
  button.addEventListener("mousedown", (event) => event.preventDefault());
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    button.disabled = true;
    void copyText(code).then(() => {
      button.textContent = "Copied";
      button.setAttribute("aria-label", "Code copied");
      window.setTimeout(() => {
        button.textContent = "Copy";
        button.setAttribute("aria-label", "Copy code");
        button.disabled = false;
      }, 1400);
    }).catch(() => {
      button.textContent = "Copy failed";
      button.setAttribute("aria-label", "Copy failed");
      window.setTimeout(() => {
        button.textContent = "Copy";
        button.setAttribute("aria-label", "Copy code");
        button.disabled = false;
      }, 1800);
    });
  });
  return button;
}

function decorationsForDocument(doc: ProseMirrorNode) {
  const decorations: Decoration[] = [];
  doc.descendants((node, position) => {
    if (node.type.name !== "codeBlock") return;
    decorations.push(Decoration.widget(position + 1, () => codeCopyButton(node.textContent), { side: -1 }));
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
