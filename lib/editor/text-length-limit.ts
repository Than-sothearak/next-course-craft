import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

/** Keep inline editors within the corresponding plain-text schema limit. */
export function textLengthLimit(maxLength: number) {
  return Extension.create({
    name: "textLengthLimit",
    addProseMirrorPlugins() {
      return [new Plugin({
        key: new PluginKey("coursecraftTextLengthLimit"),
        filterTransaction(transaction, state) {
          if (!transaction.docChanged) return true;
          const length = transaction.doc.textBetween(0, transaction.doc.content.size, "\n\n").length;
          return length <= maxLength || length < state.doc.textBetween(0, state.doc.content.size, "\n\n").length;
        },
      })];
    },
  });
}
