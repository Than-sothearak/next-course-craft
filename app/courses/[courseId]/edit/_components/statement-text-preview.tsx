"use client";

import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { textEditorExtensions } from "./text-formatting-toolbar";

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
    extensions: textEditorExtensions,
    content,
    editable: false,
    immediatelyRender: false,
  }, []);

  useEffect(() => {
    if (editor && editor.getHTML() !== content) editor.commands.setContent(content, { emitUpdate: false });
  }, [content, editor]);

  return <EditorContent editor={editor} className={`${className} [&_.tiptap]:m-0 [&_.tiptap]:outline-none [&_.tiptap_*]:text-inherit [&_.tiptap_h1]:my-0 [&_.tiptap_h2]:my-0 [&_.tiptap_h3]:my-0 [&_.tiptap_p]:my-0`} />;
}
