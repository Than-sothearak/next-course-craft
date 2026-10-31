"use client";

import type { Editor } from "@tiptap/react";
import type { ContentBlock } from "@/lib/schemas/block";
import { SlideTextBox } from "../../../_components/slide-presentation/slide-text-box";
import { HeadingBlockEditor } from "../(editor_client_components)/(content_block_editor_components)/heading-block-editor";
import { RichTextBlockEditor } from "../(editor_client_components)/(content_block_editor_components)/rich-text-block-editor";
import { StatementContentEditor } from "../(editor_client_components)/(content_block_editor_components)/statement-content-editor";

type SlideTextBlock = Extract<ContentBlock, { type: "heading" | "richText" | "statement" }>;

export function isSlideTextBlock(block: ContentBlock): block is SlideTextBlock {
  return block.type === "heading" || block.type === "richText" || block.type === "statement";
}

export function SlideTextObjectEditor({ block, onChange, onEditorFocus }: {
  block: SlideTextBlock;
  onChange: (block: ContentBlock) => void;
  onEditorFocus: (editor: Editor) => void;
}) {
  return (
    <SlideTextBox block={block}>
      {block.type === "heading" ? (
        <HeadingBlockEditor block={block} onChange={onChange} externalToolbar onEditorFocus={onEditorFocus} />
      ) : block.type === "richText" ? (
        <RichTextBlockEditor block={block} onChange={(html) => onChange({ ...block, data: { html } })} externalToolbar onEditorFocus={onEditorFocus} />
      ) : (
        <StatementContentEditor block={block} onChange={onChange} externalToolbar slideLayout onEditorFocus={onEditorFocus} />
      )}
    </SlideTextBox>
  );
}
