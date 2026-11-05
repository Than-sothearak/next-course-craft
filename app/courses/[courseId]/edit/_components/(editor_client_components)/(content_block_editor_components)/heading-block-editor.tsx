"use client";

import { useEffect } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import type { ContentBlock } from "@/lib/schemas/block";
import { textEditorExtensions } from "../(text_editing_components)/text-formatting-toolbar";
import { EquationDialog } from "../(text_editing_components)/equation-dialog";
import { SelectionTextFormattingPopup } from "../(text_editing_components)/selection-text-formatting-popup";

type HeadingBlock = Extract<ContentBlock, { type: "heading" }>;

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function getHeadingContent(block: HeadingBlock) {
  const text = block.data.text === "Add a heading" ? "" : block.data.text;
  if (block.data.html && block.data.text !== "Add a heading") return block.data.html;
  return `<h${block.data.level}>${escapeHtml(text)}</h${block.data.level}>`;
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
          level: level === 2 || level === 3 ? level : 1,
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

  return <div className="relative">
    <EquationDialog editor={editor} />
    <EditorContent editor={editor} aria-label="Edit heading text" className="min-h-10 cursor-text rounded-md [&_.tiptap]:min-h-10 [&_.tiptap]:outline-none [&_.tiptap]:text-inherit [&_.tiptap_*]:text-inherit [&_h1]:text-3xl sm:[&_h1]:text-4xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h2]:text-2xl sm:[&_h2]:text-2xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h3]:text-xl sm:[&_h3]:text-2xl [&_h3]:font-semibold [&_h3]:tracking-tight [&_p]:text-3xl sm:[&_p]:text-4xl [&_p]:font-semibold" />
    {!externalToolbar && <SelectionTextFormattingPopup editor={editor} />}
  </div>;
}
