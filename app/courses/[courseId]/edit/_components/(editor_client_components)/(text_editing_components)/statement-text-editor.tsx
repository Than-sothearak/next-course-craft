"use client";

import { useEffect, useMemo } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import Placeholder from "@tiptap/extension-placeholder";
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
  placeholder,
  externalToolbar = false,
  inheritColor = false,
  onEditorFocus,
  onChange,
}: {
  id: string;
  label: string;
  tag: "h3" | "p";
  html?: string;
  text: string;
  className?: string;
  placeholder?: string;
  externalToolbar?: boolean;
  inheritColor?: boolean;
  onEditorFocus?: (editor: Editor) => void;
  onChange: (html: string, text: string) => void;
}) {
  const { isTextSelected, onSelectionUpdate, rootRef } = useTextSelectionToolbar();
  const extensions = useMemo(
    () => placeholder
      ? [...textEditorExtensions, Placeholder.configure({ placeholder })]
      : textEditorExtensions,
    [placeholder],
  );
  const editor = useEditor({
    extensions,
    content: html ?? `<${tag}>${escapeHtml(text)}</${tag}>`,
    immediatelyRender: false,
    editorProps: { attributes: { role: "textbox", "aria-label": label } },
    onFocus: ({ editor: activeEditor }) => onEditorFocus?.(activeEditor),
    onSelectionUpdate,
    onUpdate: ({ editor: activeEditor }) => onChange(activeEditor.getHTML(), activeEditor.getText()),
  }, [id, extensions]);

  useEffect(() => {
    const content = html ?? `<${tag}>${escapeHtml(text)}</${tag}>`;
    if (editor && editor.getHTML() !== content) editor.commands.setContent(content, { emitUpdate: false });
  }, [editor, html, tag, text]);

  return <div ref={rootRef} className="relative min-w-0">
    <EditorContent
      editor={editor}
      aria-label={label}
      style={inheritColor ? { color: "inherit" } : undefined}
      className={`min-h-6 cursor-text text-slate-800 [&_.tiptap]:m-0 [&_.tiptap]:min-h-6 [&_.tiptap]:outline-none [&_.tiptap_*]:text-inherit [&_.tiptap_h1]:my-0 [&_.tiptap_h2]:my-0 [&_.tiptap_h3]:my-0 [&_.tiptap_p]:my-0 ${placeholder ? "course-description-editor" : ""} ${className}`}
    />
    {!externalToolbar && isTextSelected && <div className="absolute left-0 top-full z-40 mt-2 w-[360px] max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700 shadow-xl">
      <div className="mb-2 flex items-center gap-2 px-1 text-xs font-medium text-slate-500"><Settings2 size={14} />Edit text format</div>
      <TextFormattingToolbar editor={editor} />
    </div>}
  </div>;
}
