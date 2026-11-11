"use client";

import { useEffect } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import type { ContentBlock } from "@/lib/schemas/block";
import { richTextEditorExtensions } from "../(text_editing_components)/text-formatting-toolbar";
import { CodeExampleControls } from "./(rich_text_block_editor_components)/code-example-controls";
import { EquationDialog } from "../(text_editing_components)/equation-dialog";
import { SelectionTextFormattingPopup } from "../(text_editing_components)/selection-text-formatting-popup";

export function RichTextBlockEditor({
  block,
  onChange,
  externalToolbar = false,
  onEditorFocus,
}: {
  block: Extract<ContentBlock, { type: "richText" }>;
  onChange: (html: string) => void;
  externalToolbar?: boolean;
  onEditorFocus?: (editor: Editor) => void;
}) {
  const editor = useEditor(
    {
      extensions: richTextEditorExtensions,
      content: block.data.html,
      immediatelyRender: false,
      editorProps: {
        attributes: {
          role: "textbox",
          "aria-label": "Edit body text",
          "aria-multiline": "true",
        },
      },
      onFocus: ({ editor: activeEditor }) => onEditorFocus?.(activeEditor),
      onUpdate: ({ editor: activeEditor }) => onChange(activeEditor.getHTML()),
    },
    [block.id],
  );

  useEffect(() => {
    if (editor && editor.getHTML() !== block.data.html) {
      editor.commands.setContent(block.data.html, { emitUpdate: false });
    }
  }, [block.data.html, editor]);

  return (
    <div className="relative">
      <EquationDialog editor={editor} />
      {!externalToolbar && <CodeExampleControls editor={editor} />}
      <EditorContent
        editor={editor}
        className={`lesson-rich-text prose max-w-none focus-within:outline-none [&_.tiptap]:outline-none [&_.tiptap]:text-inherit [&_.tiptap_*]:text-inherit ${editor?.isEmpty ? "[&_.tiptap_p]:my-0" : "[&_.tiptap_p]:my-2"}`}
      />
      {<SelectionTextFormattingPopup editor={editor} />}
    </div>
  );
}
