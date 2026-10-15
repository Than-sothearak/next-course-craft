"use client";

import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { richTextEditorExtensions } from "./(editor_client_components)/(text_editing_components)/text-formatting-toolbar";

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function StatementTextPreview({
  html,
  text,
  tag,
  className,
}: {
  html?: string;
  text: string;
  tag: "h3" | "p";
  className: string;
}) {
  const content = html ?? `<${tag}>${escapeHtml(text)}</${tag}>`;
  const editor = useEditor({
    extensions: richTextEditorExtensions,
    content,
    editable: false,
    immediatelyRender: false,
  }, []);

  useEffect(() => {
    if (editor && editor.getHTML() !== content) editor.commands.setContent(content, { emitUpdate: false });
  }, [content, editor]);

  useEffect(() => {
    if (!editor) return;
    editor.view.dom.querySelectorAll("ul, ol").forEach((list) => {
      Array.from(list.children).forEach((item, index) => {
        if (item instanceof HTMLElement) item.style.setProperty("--lesson-list-item-delay", `${index * 280}ms`);
      });
    });
  }, [className, content, editor]);

  return <EditorContent editor={editor} className={`lesson-rich-text ${className} [&_.tiptap]:m-0 [&_.tiptap]:outline-none [&_.tiptap_*]:text-inherit [&_.tiptap_h1]:my-0 [&_.tiptap_h2]:my-0 [&_.tiptap_h3]:my-0 [&_.tiptap_p]:my-0`} />;
}
