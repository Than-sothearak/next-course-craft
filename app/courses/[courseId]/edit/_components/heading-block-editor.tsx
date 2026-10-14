"use client";

import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import type { ContentBlock } from "@/lib/schemas/block";
import { TextFormattingToolbar, textEditorExtensions } from "./text-formatting-toolbar";
import { useTextSelectionToolbar } from "./use-text-selection-toolbar";

type HeadingBlock = Extract<ContentBlock, { type: "heading" }>;

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function getHeadingContent(block: HeadingBlock) {
  const text = block.data.text === "Add a heading" ? "" : block.data.text;
  if (block.data.html && block.data.text !== "Add a heading") return block.data.html;
  return `<h${block.data.level}>${escapeHtml(text)}</h${block.data.level}>`;
}

export function HeadingBlockEditor({ block, onChange }: { block: HeadingBlock; onChange: (block: HeadingBlock) => void }) {
  const { isTextSelected, onSelectionUpdate, rootRef } = useTextSelectionToolbar();
  const editor = useEditor({
    extensions: textEditorExtensions,
    content: getHeadingContent(block),
    immediatelyRender: false,
    onSelectionUpdate,
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
    if (editor && editor.getHTML() !== getHeadingContent(block)) {
      editor.commands.setContent(getHeadingContent(block), { emitUpdate: false });
    }
  }, [block.data.html, block.data.level, block.data.text, editor]);

  return <div ref={rootRef} className="relative">
    <EditorContent editor={editor} aria-label="Edit heading text" className="min-h-10 cursor-text rounded-md [&_.tiptap]:min-h-10 [&_.tiptap]:outline-none [&_.tiptap]:text-inherit [&_.tiptap_*]:text-inherit [&_h1]:text-3xl sm:[&_h1]:text-4xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h2]:text-2xl sm:[&_h2]:text-3xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h3]:text-xl sm:[&_h3]:text-2xl [&_h3]:font-semibold [&_h3]:tracking-tight [&_p]:text-3xl sm:[&_p]:text-4xl [&_p]:font-semibold" />
    {isTextSelected && <div className="absolute left-0 top-full z-30 mt-2 w-[360px] max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700 shadow-xl">
      <div className="mb-2 px-1 text-xs font-medium text-slate-500">Edit text format</div>
      <TextFormattingToolbar editor={editor} />
    </div>}
  </div>;
}
