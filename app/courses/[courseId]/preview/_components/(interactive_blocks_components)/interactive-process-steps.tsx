"use client";

import { useState, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import type { ContentBlock, ProcessStepsStyle } from "@/lib/schemas/block";
import { contrastTextColor } from "../(course_preview_components)/preview-utils";
import { ProcessStepCard } from "./(interactive_process_steps_components)/process-step-card";
import { ProcessStepNavigation } from "./(interactive_process_steps_components)/process-step-navigation";
import { solidColor } from "@/lib/color";

type Steps = Extract<ContentBlock, { type: "processSteps" }>["data"]["steps"];

export function InteractiveProcessSteps({ blockId, steps, style = "cards", accentColor, showNumbers = true, onStepInteract }: {
  blockId: string; steps: Steps; style?: ProcessStepsStyle; accentColor?: string; showNumbers?: boolean; onStepInteract?: (stepId: string) => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const currentIndex = Math.min(activeIndex, steps.length - 1);
  const activeStep = steps[currentIndex];
  if (!activeStep) return null;
  const selectStep = (index: number) => {
    const next = Math.max(0, Math.min(index, steps.length - 1));
    setActiveIndex(next);
    onStepInteract?.(steps[next].id);
  };
  const colors = {
    "--process-accent": accentColor ? solidColor(accentColor) : "var(--course-primary, #2f5f9f)",
    "--process-paint": accentColor ?? "var(--course-primary, #2f5f9f)",
    "--process-accent-text": accentColor ? contrastTextColor(accentColor) : "#ffffff",
    "--process-tint": accentColor ? `${solidColor(accentColor)}12` : "#f1f5f9",
  } as CSSProperties;
  return (
    <section aria-label="Process steps" data-process-style={style} className="@container/process-steps mx-auto w-full min-w-0 max-w-3xl space-y-5" style={colors}>
      <div className="grid min-w-0 items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 @min-[20rem]/process-steps:grid-cols-[auto_minmax(0,1fr)] @min-[20rem]/process-steps:gap-3">
        <span>Step {currentIndex + 1} of {steps.length}</span>
        <div role="progressbar" aria-label="Process step progress" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={currentIndex + 1} className="h-1.5 w-full min-w-0 overflow-hidden rounded-full bg-slate-200 @min-[20rem]/process-steps:max-w-48 @min-[20rem]/process-steps:justify-self-end">
          <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${((currentIndex + 1) / steps.length) * 100}%`, background: "var(--process-paint)" }} />
        </div>
      </div>
      <div className={style === "timeline" ? "grid min-w-0 grid-cols-1 gap-4 @min-[36rem]/process-steps:grid-cols-[minmax(140px,190px)_minmax(0,1fr)]" : "min-w-0 space-y-4"}>
        {(style === "timeline" || style === "numbered") && <ProcessStepNavigation steps={steps} activeIndex={currentIndex} timeline={style === "timeline"} showNumbers={showNumbers} onSelect={selectStep} />}
        <ProcessStepCard key={`${blockId}-${activeStep.id}`} step={activeStep} index={currentIndex} style={style} showNumbers={showNumbers} accentColor={accentColor} />
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-3 @min-[20rem]/process-steps:grid-cols-2">
        <Button type="button" variant="outline" className="min-h-11 w-full min-w-0 whitespace-normal" disabled={currentIndex === 0} onClick={() => selectStep(currentIndex - 1)}>Previous step</Button>
        {currentIndex < steps.length - 1 && <Button type="button" className="min-h-11 w-full min-w-0 whitespace-normal" onClick={() => selectStep(currentIndex + 1)} style={{ background: "var(--process-paint)", color: "var(--process-accent-text)" }}>Next step</Button>}
      </div>
    </section>
  );
}
