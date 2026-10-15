"use client";

import type { ContentBlock } from "@/lib/schemas/block";
import { statementStyles } from "../../statement-block-preview";
import { StatementTextEditor } from "../(text_editing_components)/statement-text-editor";

type StatementBlock = Extract<ContentBlock, { type: "statement" }>;

export function StatementContentEditor({
  block,
  onChange,
}: {
  block: StatementBlock;
  onChange: (block: StatementBlock) => void;
}) {
  const classes = statementStyles[block.data.style];

  return <div className={classes.container}>
    <StatementTextEditor
      id={`${block.id}-title`}
      label="Statement title"
      tag="h3"
      html={block.data.titleHtml}
      text={block.data.title}
      className={classes.title}
      onChange={(titleHtml, title) => onChange({ ...block, data: { ...block.data, titleHtml, title: title.slice(0, 500) } })}
    />
    <StatementTextEditor
      id={`${block.id}-body`}
      label="Statement text"
      tag="p"
      html={block.data.bodyHtml}
      text={block.data.body}
      className={classes.body}
      onChange={(bodyHtml, body) => onChange({ ...block, data: { ...block.data, bodyHtml, body: body.slice(0, 5_000) } })}
    />
  </div>;
}
