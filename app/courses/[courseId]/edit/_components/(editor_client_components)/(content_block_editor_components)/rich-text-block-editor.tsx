"use client";

import { useEffect } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import type { ContentBlock } from "@/lib/schemas/block";
import { Settings2 } from "lucide-react";
import { TextFormattingToolbar, richTextEditorExtensions } from "../(text_editing_components)/text-formatting-toolbar";
import { CodeExampleControls } from "./(rich_text_block_editor_components)/code-example-controls";
import { useTextSelectionToolbar } from "../(text_editing_components)/use-text-selection-toolbar";

export function RichTextBlockEditor({ block, onChange, externalToolbar = false, onEditorFocus }: {
  block: Extract<ContentBlock, { type: "richText" }>;
  onChange: (html: string) => void;
  externalToolbar?: boolean;
  onEditorFocus?: (editor: Editor) => void;
}) {
  const { isTextSelected, onSelectionUpdate, rootRef } = useTextSelectionToolbar();
  const editor = useEditor({
    extensions: richTextEditorExtensions,
    content: block.data.html,
    immediatelyRender: false,
    editorProps: { attributes: { role: "textbox", "aria-label": "Edit body text", "aria-multiline": "true" } },
    onFocus: ({ editor: activeEditor }) => onEditorFocus?.(activeEditor),
    onUpdate: ({ editor: activeEditor }) => onChange(activeEditor.getHTML()),
    onSelectionUpdate,
  }, [block.id]);

  useEffect(() => {
    if (editor && editor.getHTML() !== block.data.html) {
      editor.commands.setContent(block.data.html, { emitUpdate: false });
    }
  }, [block.data.html, editor]);

  return <div ref={rootRef} className="relative">
    {!externalToolbar && <CodeExampleControls editor={editor} />}
    <EditorContent editor={editor} className={`lesson-rich-text prose max-w-none focus-within:outline-none [&_.tiptap]:outline-none [&_.tiptap]:text-inherit [&_.tiptap_*]:text-inherit ${editor?.isEmpty ? "[&_.tiptap_p]:my-0" : "[&_.tiptap_p]:my-2"}`} />
    {!externalToolbar && isTextSelected && <div className="absolute left-0 top-full z-30 mt-2 w-[360px] max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700 shadow-xl">
      <div className="mb-2 flex items-center gap-2 px-1 text-xs font-medium text-slate-500"><Settings2 size={14} />Edit text format</div>
      <TextFormattingToolbar editor={editor} />
    </div>}
  </div>;
}
