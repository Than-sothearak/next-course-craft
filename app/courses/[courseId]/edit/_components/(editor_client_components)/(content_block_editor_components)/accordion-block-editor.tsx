"use client";

import type { Editor } from "@tiptap/react";
import type { ContentBlock } from "@/lib/schemas/block";
import { InteractiveAccordion } from "@/app/courses/[courseId]/preview/interactive-blocks";
import { StatementTextEditor } from "../(text_editing_components)/statement-text-editor";

type AccordionBlock = Extract<ContentBlock, { type: "accordion" }>;

export function AccordionBlockEditor({ block, onChange, onEditorFocus }: {
  block: AccordionBlock;
  onChange: (block: ContentBlock) => void;
  onEditorFocus?: (editor: Editor) => void;
}) {
  function update(id: string, field: "title" | "body", html: string, text: string) {
    onChange({ ...block, data: { ...block.data, items: block.data.items.map((item) => item.id === id ? { ...item, [field]: text, [`${field}Html`]: html } : item) } });
  }
  return <div data-accordion-block-editor className="min-w-0 space-y-2">
    <InteractiveAccordion blockId={block.id} {...block.data}
      renderTitle={(item, index) => <StatementTextEditor id={`${block.id}-${item.id}-title`} label={`Edit accordion section ${index + 1} title`} tag="p" html={item.titleHtml} text={item.title} maxLength={160} placeholder="Section title" onEditorFocus={onEditorFocus} onChange={(html, text) => update(item.id, "title", html, text)} className="text-[20px] font-semibold" />}
      renderBody={(item, index) => <StatementTextEditor id={`${block.id}-${item.id}-body`} label={`Edit accordion section ${index + 1} explanation`} tag="p" html={item.bodyHtml} text={item.body} maxLength={5000} multiline placeholder="Explanation" onEditorFocus={onEditorFocus} onChange={(html, text) => update(item.id, "body", html, text)} className="text-base font-normal leading-6" />}
    />
  </div>;
}
