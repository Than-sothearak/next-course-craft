"use client";

import { useEffect } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import type { ContentBlock } from "@/lib/schemas/block";
import { textEditorExtensions } from "../(text_editing_components)/text-formatting-toolbar";
import { EquationDialog } from "../(text_editing_components)/equation-dialog";
import { SelectionTextFormattingPopup } from "../(text_editing_components)/selection-text-formatting-popup";
import { inlineFormattingInHtml } from "@/lib/editor/inline-formatting";

type HeadingBlock = Extract<ContentBlock, { type: "heading" }>;

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function getHeadingContent(block: HeadingBlock) {
  const text = block.data.text === "Add a heading" ? "" : block.data.text;
  const html = block.data.html && block.data.text !== "Add a heading"
    ? block.data.html
    : `<h${block.data.level}>${escapeHtml(text)}</h${block.data.level}>`;
  return inlineFormattingInHtml(html);
}

export function HeadingBlockEditor({ block, onChange, externalToolbar = false, onEditorFocus }: {
  block: HeadingBlock;
  onChange: (block: HeadingBlock) => void;
  externalToolbar?: boolean;
  onEditorFocus?: (editor: Editor) => void;
}) {
  const headingContent = getHeadingContent(block);
  const editor = useEditor({
    extensions: textEditorExtensions,
    content: headingContent,
    immediatelyRender: false,
    editorProps: { attributes: { role: "textbox", "aria-label": "Edit heading text" } },
    onFocus: ({ editor: activeEditor }) => onEditorFocus?.(activeEditor),
    onUpdate: ({ editor: activeEditor }) => {
      const level = activeEditor.getAttributes("heading").level;
      onChange({
        ...block,
        data: {
          text: activeEditor.getText().slice(0, 500),
          level: level >= 1 && level <= 6 ? level : 3,
          html: activeEditor.getHTML(),
        },
      });
    },
  }, [block.id]);

  useEffect(() => {
    if (editor && editor.getHTML() !== headingContent) {
      editor.commands.setContent(headingContent, { emitUpdate: false });
    }
  }, [headingContent, editor]);

  return <div className="lesson-rich-text relative" data-course-text-role={block.data.level === 1 ? "title" : block.data.level === 2 ? "subtitle" : "heading"}>
    <EquationDialog editor={editor} />
    <EditorContent editor={editor} aria-label="Edit heading text" className="min-h-10 cursor-text rounded-md [&_.tiptap]:min-h-10 [&_.tiptap]:outline-none [&_.tiptap]:text-inherit [&_.tiptap_*]:text-inherit [&_h1]:text-4xl sm:[&_h1]:text-5xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h2]:text-3xl sm:[&_h2]:text-4xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h3]:text-2xl sm:[&_h3]:text-3xl [&_h3]:font-semibold [&_h3]:tracking-tight [&_h4]:text-xl sm:[&_h4]:text-2xl [&_h4]:font-semibold [&_h4]:tracking-tight [&_h5]:text-lg sm:[&_h5]:text-xl [&_h5]:font-semibold [&_h5]:tracking-tight [&_h6]:text-base sm:[&_h6]:text-lg [&_h6]:font-semibold [&_h6]:tracking-tight [&_p]:text-3xl sm:[&_p]:text-4xl [&_p]:font-semibold" />
    {!externalToolbar && <SelectionTextFormattingPopup editor={editor} />}
  </div>;
}
