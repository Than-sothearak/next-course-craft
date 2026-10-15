"use client";

import { useEditorState, type Editor } from "@tiptap/react";
import { Select } from "@/components/ui/select";
import {
  codeLanguageValues,
  codeThemeValues,
  normalizeCodeLanguage,
  normalizeCodeTheme,
} from "@/lib/editor/code-example";
type CodeSelection = { position: number; theme: string; language: string };

export function CodeExampleControls({ editor }: { editor: Editor | null }) {
  const selected = useEditorState({
    editor,
    selector: ({ editor: activeEditor }): CodeSelection | null => {
      if (!activeEditor) return null;
      let selected: CodeSelection | null = null;
      activeEditor.state.doc.descendants((node, position) => {
        if (node.type.name !== "codeBlock") return;
        const containsCursor =
          activeEditor.state.selection.from >= position &&
          activeEditor.state.selection.from <= position + node.nodeSize;
        if (!selected || containsCursor)
          selected = {
            position,
            theme: normalizeCodeTheme(node.attrs.theme),
            language: normalizeCodeLanguage(node.attrs.language),
          };
        return false;
      });
      return selected;
    },
  });
  if (!editor || !selected) return null;

  function update(attribute: "theme" | "language", value: string) {
    if (!editor || !selected) return;
    editor.commands.command(({ tr }) => {
      const node = tr.doc.nodeAt(selected.position);
      if (node?.type.name !== "codeBlock") return false;
      tr.setNodeMarkup(selected.position, undefined, {
        ...node.attrs,
        [attribute]: value,
      });
      return true;
    });
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
      <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
        Code theme
        <Select
          value={selected.theme}
          onChange={(event) => update("theme", event.target.value)}
          className="h-8 w-32 text-xs"
        >
          {codeThemeValues.map((theme) => (
            <option key={theme} value={theme}>
              {theme[0].toUpperCase() + theme.slice(1)}
            </option>
          ))}
        </Select>
      </label>
      <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
        Code language
        <Select
          value={selected.language}
          onChange={(event) => update("language", event.target.value)}
          className="h-8 w-36 text-xs"
        >
          {codeLanguageValues.map((language) => (
            <option key={language} value={language}>
              {language === "auto"
                ? "Auto detect"
                : language === "plaintext"
                  ? "Plain text"
                  : language.toUpperCase()}
            </option>
          ))}
        </Select>
      </label>
    </div>
  );
}
