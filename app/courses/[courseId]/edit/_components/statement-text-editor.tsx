"use client";

import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { Settings2 } from "lucide-react";
import { TextFormattingToolbar, textEditorExtensions } from "./text-formatting-toolbar";
import { useTextSelectionToolbar } from "./use-text-selection-toolbar";

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function StatementTextEditor({
  id,
  label,
  tag,
  html,
  text,
  className = "",
  onChange,
}: {
  id: string;
  label: string;
  tag: "h3" | "p";
  html?: string;
  text: string;
  className?: string;
  onChange: (html: string, text: string) => void;
}) {
  const { isTextSelected, onSelectionUpdate, rootRef } = useTextSelectionToolbar();
  const editor = useEditor({
    extensions: textEditorExtensions,
    content: html ?? `<${tag}>${escapeHtml(text)}</${tag}>`,
    immediatelyRender: false,
    onSelectionUpdate,
    onUpdate: ({ editor: activeEditor }) => onChange(activeEditor.getHTML(), activeEditor.getText()),
  }, [id]);

  useEffect(() => {
    const content = html ?? `<${tag}>${escapeHtml(text)}</${tag}>`;
    if (editor && editor.getHTML() !== content) editor.commands.setContent(content, { emitUpdate: false });
  }, [editor, html, tag, text]);

  return <div ref={rootRef} className="relative min-w-0">
    <EditorContent
      editor={editor}
      aria-label={label}
      className={`min-h-6 cursor-text text-slate-800 [&_.tiptap]:m-0 [&_.tiptap]:min-h-6 [&_.tiptap]:outline-none [&_.tiptap_*]:text-inherit [&_.tiptap_h1]:my-0 [&_.tiptap_h2]:my-0 [&_.tiptap_h3]:my-0 [&_.tiptap_p]:my-0 ${className}`}
    />
    {isTextSelected && <div className="absolute left-0 top-full z-40 mt-2 w-[360px] max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700 shadow-xl">
      <div className="mb-2 flex items-center gap-2 px-1 text-xs font-medium text-slate-500"><Settings2 size={14} />Edit text format</div>
      <TextFormattingToolbar editor={editor} />
    </div>}
  </div>;
}
