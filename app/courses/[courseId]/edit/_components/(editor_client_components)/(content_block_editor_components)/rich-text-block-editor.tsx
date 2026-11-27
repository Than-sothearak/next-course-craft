"use client";

import { useEffect, useRef } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import type { ContentBlock } from "@/lib/schemas/block";
import { richTextEditorExtensions } from "../(text_editing_components)/text-formatting-toolbar";
import { CodeExampleControls } from "./(rich_text_block_editor_components)/code-example-controls";
import { EquationDialog } from "../(text_editing_components)/equation-dialog";
import { SelectionTextFormattingPopup } from "../(text_editing_components)/selection-text-formatting-popup";
import { reflowLongParagraphs } from "@/lib/editor/reflow-long-paragraphs";
import { inlineFormattingInHtml } from "@/lib/editor/inline-formatting";

export function RichTextBlockEditor({
  block,
  onChange,
  externalToolbar = false,
  onEditorFocus,
  standardMode = true,
}: {
  block: Extract<ContentBlock, { type: "richText" }>;
  onChange: (html: string) => void;
  externalToolbar?: boolean;
  onEditorFocus?: (editor: Editor) => void;
  standardMode?: boolean;
}) {
  const displayContent = inlineFormattingInHtml(block.data.html);
  const content = standardMode ? reflowLongParagraphs(displayContent) : displayContent;
  const observedContent = useRef({ id: block.id, html: block.data.html });
  const editor = useEditor(
    {
      extensions: richTextEditorExtensions,
      content,
      immediatelyRender: false,
      editorProps: {
        attributes: {
          role: "textbox",
          "aria-label": "Edit body text",
          "aria-multiline": "true",
        },
      },
      onFocus: ({ editor: activeEditor }) => onEditorFocus?.(activeEditor),
      onUpdate: ({ editor: activeEditor }) => {
        const html = activeEditor.getHTML();
        observedContent.current = { id: block.id, html };
        onChange(html);
      },
    },
    [block.id],
  );

  useEffect(() => {
    if (!editor || (observedContent.current.id === block.id && observedContent.current.html === block.data.html)) return;
    if (editor.getHTML() !== content) editor.commands.setContent(content, { emitUpdate: false });
    observedContent.current = { id: block.id, html: block.data.html };
  }, [block.id, block.data.html, content, editor]);

  return (
    <div className="relative">
      <EquationDialog editor={editor} />
      {!externalToolbar && <CodeExampleControls editor={editor} />}
      <EditorContent
        editor={editor}
        className={`lesson-rich-text prose max-w-none focus-within:outline-none [&_.tiptap]:outline-none [&_.tiptap]:text-inherit [&_.tiptap_*]:text-inherit ${standardMode ? "[&_strong]:text-[var(--course-primary,#2f5f9f)]" : ""} ${editor?.isEmpty ? "[&_.tiptap_p]:my-0" : "[&_.tiptap_p]:my-2"}`}
      />
      {<SelectionTextFormattingPopup editor={editor} />}
    </div>
  );
}
