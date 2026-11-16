"use client";

import { useEffect, useMemo, useRef } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import Placeholder from "@tiptap/extension-placeholder";
import { textEditorExtensions, richTextEditorExtensions } from "./text-formatting-toolbar";
import { textLengthLimit } from "@/lib/editor/text-length-limit";
import { EquationDialog } from "./equation-dialog";
import { SelectionTextFormattingPopup } from "./selection-text-formatting-popup";
import { reflowLongParagraphs } from "@/lib/editor/reflow-long-paragraphs";
import { highlightInlineCodeTermsInHtml } from "@/lib/editor/inline-formatting";

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
  standardMode = false,
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
  standardMode?: boolean;
  onChange: (html: string, text: string) => void;
}) {
  const sourceContent = html ?? `<${tag}>${escapeHtml(text)}</${tag}>`;
  const displayContent = highlightInlineCodeTermsInHtml(sourceContent);
  const content = standardMode && tag === "p" ? reflowLongParagraphs(displayContent) : displayContent;
  const observedContent = useRef(sourceContent);
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
    content,
    immediatelyRender: false,
    editorProps: { attributes: { role: "textbox", "aria-label": label, "aria-multiline": String(multiline) } },
    onFocus: ({ editor: activeEditor }) => onEditorFocus?.(activeEditor),
    onUpdate: ({ editor: activeEditor }) => {
      const nextHtml = activeEditor.getHTML();
      observedContent.current = nextHtml;
      onChange(nextHtml, activeEditor.getText());
    },
  }, [id, extensions]);

  useEffect(() => {
    if (!editor) return;
    // Event/section ordering can change the visible position while retaining
    // this editor instance and its authored content.
    editor.setOptions({ editorProps: { ...editor.options.editorProps, attributes: { role: "textbox", "aria-label": label, "aria-multiline": String(multiline) } } });
  }, [editor, label, multiline]);

  useEffect(() => {
    if (!editor || observedContent.current === sourceContent) return;
    if (editor.getHTML() !== content) editor.commands.setContent(content, { emitUpdate: false });
    observedContent.current = sourceContent;
  }, [editor, content, sourceContent]);

  return <div className="relative min-w-0">
    <EquationDialog editor={editor} />
    <EditorContent
      editor={editor}
      aria-label={label}
      style={inheritColor ? { color: "inherit" } : undefined}
      className={`min-h-6 cursor-text text-slate-800 [&_.tiptap]:m-0 [&_.tiptap]:min-h-6 [&_.tiptap]:outline-none [&_.tiptap_*]:text-inherit [&_.tiptap_h1]:my-0 [&_.tiptap_h2]:my-0 [&_.tiptap_h3]:my-0 [&_.tiptap_p]:my-0 ${standardMode ? "[&_strong]:text-[var(--course-primary,#2f5f9f)]" : ""} ${placeholder ? "course-description-editor" : ""} ${className}`}
    />
    {!externalToolbar && <SelectionTextFormattingPopup editor={editor} />}
  </div>;
}
