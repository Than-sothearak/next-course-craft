import { LockKeyhole, Video } from "lucide-react";
import type { BlockTemplate } from "./block-template-data";
import { InputBlockPreview } from "../input-block-preview";
import { StatementBlockPreview } from "../../statement-block-preview";
import { ChartBlockPreview } from "../../../../preview/chart-block";
import { AccordionTemplatePreview } from "./(template_preview_components)/accordion-template-preview";
import { FlipCardTemplatePreview } from "./(template_preview_components)/flip-card-template-preview";
import { ImageTemplatePreview } from "./(template_preview_components)/image-template-preview";
import { LabeledGraphicTemplatePreview } from "./(template_preview_components)/labeled-graphic-template-preview";
import { ListTemplatePreview } from "./(template_preview_components)/list-template-preview";
import { ProcessStepsTemplatePreview } from "./(template_preview_components)/process-steps-template-preview";
import { TextTemplatePreview } from "./(template_preview_components)/text-template-preview";
import { CodeTemplatePreview } from "./(template_preview_components)/code-template-preview";

export function TemplatePreview({ template }: { template: BlockTemplate }) {
  const kind = template.preview;
  if (template.type === "statement" && template.statement)
    return <StatementBlockPreview {...template.statement} />;
  if (template.type === "flipCard" && template.flipCard)
    return <FlipCardTemplatePreview cards={template.flipCard.cards} />;
  if (template.type === "accordion" && template.accordion)
    return <AccordionTemplatePreview data={template.accordion} />;
  if (template.type === "labeledGraphic" && template.labeledGraphic)
    return <LabeledGraphicTemplatePreview data={template.labeledGraphic} />;
  if (template.type === "processSteps" && template.processSteps)
    return <ProcessStepsTemplatePreview data={template.processSteps} />;
  if (template.type === "chart" && template.chart)
    return <ChartBlockPreview data={template.chart} />;
  if (kind === "knowledge")
    return (
      <InputBlockPreview
        type="knowledgeCheck"
        question="Which option best describes the key idea?"
        options={[
          "It takes practice",
          "It happens instantly",
          "It needs no feedback",
        ]}
      />
    );
  if (kind === "survey")
    return (
      <InputBlockPreview
        type="survey"
        question="How confident do you feel?"
        minLabel="Not yet"
        maxLabel="Very confident"
      />
    );
  if (kind === "title" || kind === "text" || kind.startsWith("text-"))
    return <TextTemplatePreview kind={kind} />;
  if (kind === "quote")
    return (
      <blockquote className="border-l-2 border-slate-300 pl-3 text-[11px] italic leading-4 text-slate-700">
        <p>
          “Great things are done by a series of small things brought together.”
        </p>
        <footer className="mt-2 text-[10px] not-italic text-slate-500">
          Vincent van Gogh
        </footer>
      </blockquote>
    );
  if (kind === "quote-pull")
    return (
      <blockquote className="border-l-2 border-indigo-500 pl-3 text-sm font-semibold leading-5 text-slate-800">
        <p>“Write a memorable line here.”</p>
        <footer className="mt-2 text-[10px] font-normal text-slate-500">
          — Attribution
        </footer>
      </blockquote>
    );
  if (kind === "quote-centered")
    return (
      <blockquote className="border-l-2 border-slate-300 pl-3 text-center text-[11px] italic leading-4 text-slate-700">
        <p>“A short thought worth remembering.”</p>
        <footer className="mt-2 text-[10px] not-italic text-slate-500">
          — Attribution
        </footer>
      </blockquote>
    );
  if (kind === "quote-citation")
    return (
      <blockquote className="border-l-2 border-emerald-500 pl-3 text-[11px] leading-4 text-slate-700">
        <p>“Add a sourced quotation to support this lesson.”</p>
        <footer className="mt-2 text-[10px] text-slate-500">
          Source title, author, year
        </footer>
      </blockquote>
    );
  if (kind === "quote-testimonial")
    return (
      <blockquote className="border-l-2 border-violet-400 pl-3 text-[11px] italic leading-4 text-slate-700">
        <p>“This course helped me put the ideas into practice.”</p>
        <footer className="mt-2 text-[10px] not-italic font-semibold text-slate-600">
          Learner name{" "}
          <span className="font-normal text-slate-400">
            · Role or organization
          </span>
        </footer>
      </blockquote>
    );
  if (kind === "list") return <ListTemplatePreview style="disc" />;
  if (kind === "numbered") return <ListTemplatePreview style="numbered" />;
  if (kind === "lettered") return <ListTemplatePreview style="lettered" />;
  if (kind === "roman") return <ListTemplatePreview style="roman" />;
  if (kind === "circle-bullets") return <ListTemplatePreview style="circle" />;
  if (kind === "square-bullets") return <ListTemplatePreview style="square" />;
  if (kind === "checklist") return <ListTemplatePreview style="check" />;
  if (kind === "dash-list") return <ListTemplatePreview style="dash" />;
  if (kind.startsWith("image"))
    return <ImageTemplatePreview layout={template.imageLayout ?? "full"} />;
  if (kind === "gallery")
    return (
      <div className="grid grid-cols-3 gap-1.5">
        {[
          "from-amber-200 to-rose-300",
          "from-sky-200 to-indigo-300",
          "from-emerald-200 to-teal-400",
        ].map((colors, index) => (
          <div
            key={index}
            className={`relative h-20 overflow-hidden rounded bg-gradient-to-br ${colors}`}
          >
            <span className="absolute bottom-0 left-0 h-1/2 w-full bg-gradient-to-t from-slate-900/25 to-transparent" />
          </div>
        ))}
      </div>
    );
  if (kind === "video")
    return (
      <div className="relative grid h-24 place-items-center overflow-hidden rounded-md bg-gradient-to-br from-slate-700 via-slate-800 to-indigo-950">
        <div className="absolute bottom-2 left-2 right-2 h-1 rounded-full bg-white/30">
          <span className="block h-full w-1/3 rounded-full bg-indigo-400" />
        </div>
        <span className="relative grid size-9 place-items-center rounded-full bg-white/95 pl-0.5 text-slate-800 shadow">
          <Video size={16} />
        </span>
        <span className="absolute left-2 top-2 text-[9px] font-medium text-white/90">
          Course introduction
        </span>
      </div>
    );
  if (kind === "divider")
    return (
      <div className="flex items-center gap-2">
        <span className="h-px flex-1 bg-slate-300" />
        <span className="text-[9px] text-slate-400">Section break</span>
        <span className="h-px flex-1 bg-slate-300" />
      </div>
    );
  if (kind === "spacer")
    return (
      <div className="grid h-20 place-items-center text-[10px] text-slate-400">
        <span className="rounded border border-dashed border-slate-300 px-3 py-1">
          Space between sections
        </span>
      </div>
    );
  if (
    kind === "continue" ||
    kind === "continue-reading" ||
    kind === "continue-required"
  )
    return (
      <div className="flex justify-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-[10px] font-semibold text-white shadow-sm">
          {kind === "continue-required" && (
            <LockKeyhole size={11} aria-hidden="true" />
          )}
          {kind === "continue-reading" ? "Continue reading" : "Continue"}
        </span>
      </div>
    );
  if (kind === "blank")
    return (
      <div className="grid h-20 place-items-center rounded-md border border-dashed border-slate-300 text-[10px] text-slate-400">
        Start writing here…
      </div>
    );
  if (kind === "code")
    return <CodeTemplatePreview template={template.codeTemplate} />;
  return <div className="h-12 rounded-md bg-slate-100" />;
}
