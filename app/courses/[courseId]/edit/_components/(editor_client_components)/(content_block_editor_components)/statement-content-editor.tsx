"use client";

import type { ContentBlock } from "@/lib/schemas/block";
import type { Editor } from "@tiptap/react";
import { statementStyles } from "../../statement-block-preview";
import { StatementTextEditor } from "../(text_editing_components)/statement-text-editor";

type StatementBlock = Extract<ContentBlock, { type: "statement" }>;

export function StatementContentEditor({
  block,
  onChange,
  externalToolbar,
  slideLayout = false,
  onEditorFocus,
}: {
  block: StatementBlock;
  onChange: (block: StatementBlock) => void;
  externalToolbar?: boolean;
  slideLayout?: boolean;
  onEditorFocus?: (editor: Editor) => void;
}) {
  const classes = statementStyles[block.data.style];

  return <div className={classes.container} style={slideLayout ? { backgroundColor: "transparent", color: "inherit" } : undefined}>
    <StatementTextEditor
      id={`${block.id}-title`}
      label="Statement title"
      tag="h3"
      html={block.data.titleHtml}
      text={block.data.title}
      externalToolbar={externalToolbar}
      inheritColor={slideLayout}
      onEditorFocus={onEditorFocus}
      className={classes.title}
      onChange={(titleHtml, title) => onChange({ ...block, data: { ...block.data, titleHtml, title: title.slice(0, 500) } })}
    />
    <StatementTextEditor
      id={`${block.id}-body`}
      label="Statement text"
      tag="p"
      html={block.data.bodyHtml}
      text={block.data.body}
      externalToolbar={externalToolbar}
      inheritColor={slideLayout}
      onEditorFocus={onEditorFocus}
      className={classes.body}
      onChange={(bodyHtml, body) => onChange({ ...block, data: { ...block.data, bodyHtml, body: body.slice(0, 5_000) } })}
    />
  </div>;
}
