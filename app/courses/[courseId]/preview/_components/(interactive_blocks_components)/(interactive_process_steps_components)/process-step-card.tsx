import type { ContentBlock, ProcessMediaLayout, ProcessStepsStyle } from "@/lib/schemas/block";
import { textPaint } from "@/lib/color";
import type { ReactNode } from "react";
import { StatementTextPreview } from "@/app/courses/[courseId]/edit/_components/statement-text-preview";
import { ProcessStepAssets } from "./process-step-media";

type Step = Extract<ContentBlock, { type: "processSteps" }>["data"]["steps"][number];

const cardClasses: Record<ProcessStepsStyle, string> = {
  cards: "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm @min-[36rem]/process-steps:p-8",
  numbered: "rounded-xl border border-slate-200 bg-white p-4 @min-[36rem]/process-steps:p-8",
  timeline: "rounded-xl border border-slate-200 bg-white p-4 @min-[36rem]/process-steps:p-6",
  spotlight: "rounded-2xl border-t-4 p-4 shadow-sm @min-[36rem]/process-steps:p-8",
  minimal: "border-0 bg-transparent py-4",
  slider: "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm @min-[36rem]/process-steps:p-6",
};

export function ProcessStepCard({ step, index, style, showNumbers, accentColor, presentation, decorative, mediaLayout, renderTitle, renderBody, renderMedia }: { step: Step; index: number; style: ProcessStepsStyle; showNumbers: boolean; accentColor?: string; presentation?: boolean; decorative?: boolean; mediaLayout?: ProcessMediaLayout; renderTitle?: (step: Step, index: number) => ReactNode; renderBody?: (step: Step, index: number) => ReactNode; renderMedia?: (step: Step, index: number) => ReactNode }) {
  const media = (renderMedia || step.media || step.attachment) && <div className={style === "slider" ? "mb-4" : "mt-4"}>{renderMedia ? renderMedia(step, index) : <ProcessStepAssets step={step} layout={mediaLayout} presentation={presentation} decorative={decorative} />}</div>;
  return (
    <article aria-live="polite" className={`min-h-40 min-w-0 [overflow-wrap:anywhere] ${cardClasses[style]}`} style={style === "spotlight" ? { borderColor: "var(--process-accent)", backgroundColor: "var(--process-tint)" } : undefined}>
      {style === "slider" && media}
      {showNumbers && style !== "slider" && <span
        className={style === "numbered" ? "block text-5xl font-bold leading-none" : style === "minimal" ? "block text-3xl font-bold" : "grid size-9 place-items-center rounded-full text-sm font-bold"}
        style={style === "numbered" || style === "minimal"
          ? textPaint(accentColor ?? "var(--process-accent)")
          : { background: "var(--process-paint)", color: "var(--process-accent-text)" }}
      >{index + 1}</span>}
      {(renderTitle || step.title.trim()) && <div className={showNumbers && style !== "slider" ? "mt-4" : "mt-0"}>
        {renderTitle ? renderTitle(step, index) : step.titleHtml !== undefined
          ? <StatementTextPreview tag="h3" text={step.title} html={step.titleHtml} className="text-[20px] font-semibold text-slate-900" />
          : <h3 className="text-[20px] font-semibold text-slate-900">{step.title}</h3>}
      </div>}
      <div className="mt-2 text-base leading-6 text-slate-700">
        {renderBody ? renderBody(step, index) : step.bodyHtml !== undefined
          ? <StatementTextPreview tag="p" text={step.body} html={step.bodyHtml} className="prose max-w-none text-base leading-6" />
          : <p className="whitespace-pre-wrap">{step.body}</p>}
      </div>
      {style !== "slider" && media}
    </article>
  );
}
