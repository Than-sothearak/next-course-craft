import { Button } from "@/components/ui/button";
import type { ContentBlock } from "@/lib/schemas/block";

type Steps = Extract<ContentBlock, { type: "processSteps" }>["data"]["steps"];

export function ProcessStepNavigation({ steps, activeIndex, timeline, showNumbers, onSelect }: { steps: Steps; activeIndex: number; timeline: boolean; showNumbers: boolean; onSelect: (index: number) => void }) {
  return (
    <nav aria-label="Process step navigation" className={`min-w-0 max-w-full overflow-x-auto overscroll-x-contain ${timeline ? "@min-[36rem]/process-steps:max-h-96 @min-[36rem]/process-steps:overflow-y-auto" : ""}`}>
      <ol className={`flex gap-2 pb-2 ${timeline ? "@min-[36rem]/process-steps:flex-col @min-[36rem]/process-steps:pb-0" : ""}`}>
        {steps.map((step, index) => (
          <li key={step.id} className={`relative w-40 max-w-full shrink-0 ${timeline ? "@min-[36rem]/process-steps:w-full" : ""}`}>
            {timeline && index < steps.length - 1 && <span aria-hidden="true" className="absolute bottom-0 left-5 top-8 hidden w-px translate-y-3 bg-slate-200 @min-[36rem]/process-steps:block" />}
            <Button
              type="button" variant="ghost" aria-current={index === activeIndex ? "step" : undefined}
              aria-label={`View step ${index + 1}: ${step.title || `Step ${index + 1}`}`} onClick={() => onSelect(index)}
              className={`relative h-auto min-h-11 w-full min-w-0 gap-2 whitespace-normal px-2 py-2 text-xs ${timeline ? "justify-start text-left" : "flex-col text-center"}`}
              style={index === activeIndex ? { backgroundColor: "var(--process-tint)", color: "var(--process-accent)" } : undefined}
            >
              {showNumbers && <span className="grid size-7 shrink-0 place-items-center rounded-full border text-xs font-bold" style={index === activeIndex ? { backgroundColor: "var(--process-accent)", borderColor: "var(--process-accent)", color: "var(--process-accent-text)" } : { borderColor: "#cbd5e1", backgroundColor: "#ffffff", color: "#475569" }}>{index + 1}</span>}
              <span className="line-clamp-2 min-w-0 max-w-full [overflow-wrap:anywhere]">{step.title || `Step ${index + 1}`}</span>
            </Button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
