"use client";

import { useEffect } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { TextFormattingToolbar, textEditorExtensions } from "./text-formatting-toolbar";
import { useTextSelectionToolbar } from "./use-text-selection-toolbar";

function titleContent(title: string, html?: string) {
  return html ?? `<h1>${title.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</h1>`;
}

function titleError(editor: Editor | null) {
  if (!editor) return "";
  const text = editor.getText().trim();
  if (!text) return "Enter a lesson title before saving.";
  if (text.length > 160) return "Keep the lesson title to 160 characters or fewer.";
  if (editor.getHTML().length > 100_000) return "The title has too much formatting. Clear some formatting before saving.";
  return "";
}

export function LessonTitleEditor({ title, html, onChange, onValidityChange, compact = false }: {
  title: string;
  html?: string;
  onChange: (title: string, html: string) => void;
  onValidityChange: (valid: boolean) => void;
  compact?: boolean;
}) {
  const { isTextSelected, onSelectionUpdate, rootRef } = useTextSelectionToolbar();
  const editor = useEditor({
    extensions: textEditorExtensions,
    content: titleContent(title, html),
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editorProps: { attributes: { role: "textbox", "aria-label": "Lesson title", "aria-multiline": "true" } },
    onSelectionUpdate,
    onTransaction: ({ editor: activeEditor }) => onValidityChange(!titleError(activeEditor)),
    onUpdate: ({ editor: activeEditor }) => {
      const nextTitle = activeEditor.getText().trim();
      const nextHtml = activeEditor.getHTML();
      if (!titleError(activeEditor)) onChange(nextTitle, nextHtml);
    },
  });

  useEffect(() => {
    const content = titleContent(title, html);
    if (editor && editor.getHTML() !== content) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [editor, title, html]);

  const error = titleError(editor);

  return <div ref={rootRef} className={`relative mx-auto w-full max-w-[720px] px-4 ${compact ? "py-5" : "py-10"}`}>
    <EditorContent editor={editor} className="min-h-12 cursor-text break-words rounded-md [&_.tiptap]:min-h-12 [&_.tiptap]:outline-none [&_h1]:text-3xl sm:[&_h1]:text-4xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h2]:text-2xl sm:[&_h2]:text-3xl [&_h2]:font-semibold [&_h3]:text-xl sm:[&_h3]:text-2xl [&_h3]:font-semibold [&_p]:text-base [&_p]:font-normal" />
    {error && <p role="alert" className="mt-2 text-xs text-rose-700">{error}</p>}
    {isTextSelected && <div className="mt-3 rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700 shadow-sm"><TextFormattingToolbar editor={editor} allowLists={false} /></div>}
  </div>;
}
