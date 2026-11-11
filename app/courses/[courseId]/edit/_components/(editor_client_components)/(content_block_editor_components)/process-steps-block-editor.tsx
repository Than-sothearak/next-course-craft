"use client";

import type { Editor } from "@tiptap/react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ContentBlock } from "@/lib/schemas/block";
import { InteractiveProcessSteps } from "@/app/courses/[courseId]/preview/interactive-blocks";
import { ProcessStepMedia } from "@/app/courses/[courseId]/preview/_components/(interactive_blocks_components)/(interactive_process_steps_components)/process-step-media";
import { StatementTextEditor } from "../(text_editing_components)/statement-text-editor";
import { ProcessStepMediaEditor } from "./process-step-media-editor";

type ProcessBlock = Extract<ContentBlock, { type: "processSteps" }>;
type Step = ProcessBlock["data"]["steps"][number];

function plainInstructionsHtml(text: string) {
  return `<p>${text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replace(/\r?\n/g, "<br>")}</p>`;
}

export function ProcessStepsBlockEditor({ block, courseId, onChange, onEditorFocus }: {
  block: ProcessBlock;
  courseId?: string;
  onChange: (block: ContentBlock) => void;
  onEditorFocus?: (editor: Editor) => void;
}) {
  function update(id: string, patch: Partial<Step>) {
    onChange({ ...block, data: { ...block.data, steps: block.data.steps.map((step) => step.id === id ? { ...step, ...patch } : step) } });
  }
  return <div data-process-steps-editor className="min-w-0">
    <InteractiveProcessSteps blockId={block.id} {...block.data}
      renderTitle={(step, index) => <StatementTextEditor id={`${block.id}-${step.id}-title`} label={`Edit process step ${index + 1} title`} tag="h3" html={step.titleHtml} text={step.title} maxLength={160} placeholder="Step title (optional)" onEditorFocus={onEditorFocus} onChange={(html, text) => update(step.id, { title: text, titleHtml: html })} className="text-lg font-semibold" />}
      renderBody={(step, index) => <StatementTextEditor id={`${block.id}-${step.id}-body`} label={`Edit process step ${index + 1} instructions`} tag="p" html={step.bodyHtml ?? plainInstructionsHtml(step.body)} text={step.body} maxLength={5000} multiline placeholder="Add instructions. Select text to format or add a link." onEditorFocus={onEditorFocus} onChange={(html, text) => update(step.id, { body: text, bodyHtml: html })} className="lesson-rich-text text-sm leading-6" />}
      renderMedia={(step, index) => <div className="space-y-3">
        {step.media && <ProcessStepMedia media={step.media} />}
        {courseId && <ProcessStepMediaEditor step={step} index={index} courseId={courseId} onChange={(media) => update(step.id, { media })} />}
      </div>}
      renderControl={({ direction, disabled, onClick }) => {
        const field = direction === "previous" ? "previousLabel" : "nextLabel";
        const label = direction === "previous" ? "Previous step" : "Next step";
        return <div className={`${buttonVariants({ variant: direction === "previous" ? "outline" : "default" })} min-h-11 min-w-0 gap-1 px-2`} style={direction === "next" ? { background: "var(--process-paint)", color: "var(--process-accent-text)" } : undefined}>
          <Input aria-label={`Edit process ${direction} button label`} value={block.data[field] ?? label} maxLength={120} placeholder={label} onChange={(event) => onChange({ ...block, data: { ...block.data, [field]: event.target.value } })} className="h-8 min-w-0 border-transparent bg-transparent px-1 text-center text-inherit shadow-none placeholder:text-current" />
          <Button variant="ghost" size="icon" className="size-8 shrink-0 text-inherit hover:text-inherit" aria-label={`Go to ${direction} process step`} disabled={disabled} onClick={onClick}>{direction === "previous" ? <ArrowLeft size={16} /> : <ArrowRight size={16} />}</Button>
        </div>;
      }}
    />
  </div>;
}
