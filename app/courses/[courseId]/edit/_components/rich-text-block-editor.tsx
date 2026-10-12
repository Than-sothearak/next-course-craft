"use client";

import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import type { ContentBlock } from "@/lib/schemas/block";
import { Settings2 } from "lucide-react";
import { TextFormattingToolbar, textEditorExtensions } from "./text-formatting-toolbar";
import { useTextSelectionToolbar } from "./use-text-selection-toolbar";

export function RichTextBlockEditor({ block, onChange }: { block: Extract<ContentBlock, { type: "richText" }>; onChange: (html: string) => void }) {
  const { isTextSelected, onSelectionUpdate, rootRef } = useTextSelectionToolbar();
  const editor = useEditor({
    extensions: textEditorExtensions,
    content: block.data.html,
    immediatelyRender: false,
    onUpdate: ({ editor: activeEditor }) => onChange(activeEditor.getHTML()),
    onSelectionUpdate,
  }, [block.id]);

  useEffect(() => {
    if (editor && editor.getHTML() !== block.data.html) {
      editor.commands.setContent(block.data.html, { emitUpdate: false });
    }
  }, [block.data.html, editor]);

  return <div ref={rootRef} className="relative">
    <EditorContent editor={editor} className={`prose max-w-none px-5 focus-within:outline-none [&_.tiptap]:outline-none [&_.tiptap]:text-inherit [&_.tiptap_*]:text-inherit ${editor?.isEmpty ? "py-0 [&_.tiptap_p]:my-0" : "py-4 [&_.tiptap_p]:my-2"}`} />
    {isTextSelected && <div className="absolute left-0 top-full z-30 mt-2 w-[360px] max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700 shadow-xl">
      <div className="mb-2 flex items-center gap-2 px-1 text-xs font-medium text-slate-500"><Settings2 size={14} />Edit text format</div>
      <TextFormattingToolbar editor={editor} />
    </div>}
  </div>;
}
