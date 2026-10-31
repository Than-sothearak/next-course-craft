import type { ContentBlock, ProcessStepsStyle } from "@/lib/schemas/block";
import { textPaint } from "@/lib/color";

type Step = Extract<ContentBlock, { type: "processSteps" }>["data"]["steps"][number];

const cardClasses: Record<ProcessStepsStyle, string> = {
  cards: "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm @min-[36rem]/process-steps:p-8",
  numbered: "rounded-xl border border-slate-200 bg-white p-4 @min-[36rem]/process-steps:p-8",
  timeline: "rounded-xl border border-slate-200 bg-white p-4 @min-[36rem]/process-steps:p-6",
  spotlight: "rounded-2xl border-t-4 p-4 shadow-sm @min-[36rem]/process-steps:p-8",
  minimal: "border-0 bg-transparent py-4",
};

export function ProcessStepCard({ step, index, style, showNumbers, accentColor }: { step: Step; index: number; style: ProcessStepsStyle; showNumbers: boolean; accentColor?: string }) {
  return (
    <article aria-live="polite" className={`min-h-40 min-w-0 [overflow-wrap:anywhere] ${cardClasses[style]}`} style={style === "spotlight" ? { borderColor: "var(--process-accent)", backgroundColor: "var(--process-tint)" } : undefined}>
      {showNumbers && <span
        className={style === "numbered" ? "block text-5xl font-bold leading-none" : style === "minimal" ? "block text-3xl font-bold" : "grid size-9 place-items-center rounded-full text-sm font-bold"}
        style={style === "numbered" || style === "minimal"
          ? textPaint(accentColor ?? "var(--process-accent)")
          : { background: "var(--process-paint)", color: "var(--process-accent-text)" }}
      >{index + 1}</span>}
      <h3 className={`${showNumbers ? "mt-4" : "mt-0"} text-lg font-semibold text-slate-900`}>{step.title || `Step ${index + 1}`}</h3>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{step.body || "Add instructions for this step."}</p>
    </article>
  );
}
