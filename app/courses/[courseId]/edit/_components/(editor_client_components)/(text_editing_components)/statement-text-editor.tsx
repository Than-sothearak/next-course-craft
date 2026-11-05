"use client";

import { useEffect, useMemo } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import Placeholder from "@tiptap/extension-placeholder";
import { textEditorExtensions, richTextEditorExtensions } from "./text-formatting-toolbar";
import { textLengthLimit } from "@/lib/editor/text-length-limit";
import { EquationDialog } from "./equation-dialog";
import { SelectionTextFormattingPopup } from "./selection-text-formatting-popup";

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
  multiline = false,
  maxLength,
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
  multiline?: boolean;
  maxLength?: number;
  onEditorFocus?: (editor: Editor) => void;
  onChange: (html: string, text: string) => void;
}) {
  const extensions = useMemo(
    () => [
      ...(multiline ? richTextEditorExtensions : textEditorExtensions),
      ...(placeholder ? [Placeholder.configure({ placeholder })] : []),
      ...(maxLength === undefined ? [] : [textLengthLimit(maxLength)]),
    ],
    [placeholder, multiline, maxLength],
  );
  const editor = useEditor({
    extensions,
    content: html ?? `<${tag}>${escapeHtml(text)}</${tag}>`,
    immediatelyRender: false,
    editorProps: { attributes: { role: "textbox", "aria-label": label, "aria-multiline": String(multiline) } },
    onFocus: ({ editor: activeEditor }) => onEditorFocus?.(activeEditor),
    onUpdate: ({ editor: activeEditor }) => onChange(activeEditor.getHTML(), activeEditor.getText()),
  }, [id, extensions]);

  useEffect(() => {
    const content = html ?? `<${tag}>${escapeHtml(text)}</${tag}>`;
    if (editor && editor.getHTML() !== content) editor.commands.setContent(content, { emitUpdate: false });
  }, [editor, html, tag, text]);

  return <div className="relative min-w-0">
    <EquationDialog editor={editor} />
    <EditorContent
      editor={editor}
      aria-label={label}
      style={inheritColor ? { color: "inherit" } : undefined}
      className={`min-h-6 cursor-text text-slate-800 [&_.tiptap]:m-0 [&_.tiptap]:min-h-6 [&_.tiptap]:outline-none [&_.tiptap_*]:text-inherit [&_.tiptap_h1]:my-0 [&_.tiptap_h2]:my-0 [&_.tiptap_h3]:my-0 [&_.tiptap_p]:my-0 ${placeholder ? "course-description-editor" : ""} ${className}`}
    />
    {!externalToolbar && <SelectionTextFormattingPopup editor={editor} />}
  </div>;
}
