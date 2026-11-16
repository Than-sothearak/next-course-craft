"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { ContentBlock, ProcessMediaLayout, ProcessStepsStyle } from "@/lib/schemas/block";
import { contrastTextColor } from "../(course_preview_components)/preview-utils";
import { ProcessStepCard } from "./(interactive_process_steps_components)/process-step-card";
import { ProcessStepNavigation } from "./(interactive_process_steps_components)/process-step-navigation";
import { solidColor } from "@/lib/color";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from "lucide-react";

type Steps = Extract<ContentBlock, { type: "processSteps" }>["data"]["steps"];
type Step = Steps[number];
export type ProcessStepControl = { direction: "previous" | "next"; label: string; disabled: boolean; onClick: () => void };

function shuffledForActivity(steps: Steps, blockId: string): Steps {
  const shuffled = [...steps];
  let seed = 2166136261;
  for (const character of `${blockId}:${steps.map((step) => step.id).join(":")}`)
    seed = Math.imul(seed ^ character.charCodeAt(0), 16777619);
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const target = seed % (index + 1);
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  if (shuffled.length > 1 && shuffled.every((step, index) => step.id === steps[index]?.id))
    [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
  return shuffled;
}

export function InteractiveProcessSteps({ blockId, steps, style = "cards", activityMode = "guided", orderingCompleted = false, onActivityComplete, authoring = false, accentColor, showNumbers = true, previousLabel, nextLabel, mediaLayout, onStepInteract, presentation = false, decorative = false, renderTitle, renderBody, renderMedia, renderControl }: {
  blockId: string; steps: Steps; style?: ProcessStepsStyle; activityMode?: "guided" | "ordering"; orderingCompleted?: boolean; onActivityComplete?: () => void; authoring?: boolean; accentColor?: string; showNumbers?: boolean; previousLabel?: string; nextLabel?: string; onStepInteract?: (stepId: string) => void; presentation?: boolean;
  renderTitle?: (step: Step, index: number) => ReactNode;
  renderBody?: (step: Step, index: number) => ReactNode;
  renderMedia?: (step: Step, index: number) => ReactNode;
  renderControl?: (control: ProcessStepControl) => ReactNode;
  decorative?: boolean;
  mediaLayout?: ProcessMediaLayout;
}) {
  const [orderingSteps, setOrderingSteps] = useState<Steps>(() => activityMode === "ordering" ? shuffledForActivity(steps, blockId) : steps);
  const [orderingFeedback, setOrderingFeedback] = useState<"incorrect" | "correct" | null>(orderingCompleted ? "correct" : null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState<"next" | "previous" | null>(null);
  const currentIndex = Math.min(activeIndex, steps.length - 1);
  const activeStep = steps[currentIndex];
  if (!activeStep) return null;
  const selectStep = (index: number) => {
    const next = Math.max(0, Math.min(index, steps.length - 1));
    if (next !== currentIndex) setSlideDirection(next > currentIndex ? "next" : "previous");
    if (presentation) onStepInteract?.(activeStep.id);
    setActiveIndex(next);
    onStepInteract?.(steps[next].id);
  };
  const colors = {
    "--process-accent": accentColor ? solidColor(accentColor) : "var(--course-primary, #2f5f9f)",
    "--process-paint": accentColor ?? "var(--course-primary, #2f5f9f)",
    "--process-accent-text": accentColor ? contrastTextColor(accentColor) : "#ffffff",
    "--process-tint": "color-mix(in srgb, var(--process-accent) 7%, white)",
  } as CSSProperties;
  if (activityMode === "ordering") {
    if (authoring) return <section aria-label="Ordering activity author preview" data-process-activity="ordering" className="mx-auto w-full min-w-0 max-w-3xl space-y-3" style={colors}>
      <p className="text-sm leading-6 text-slate-600">Learners will receive these steps in a shuffled order and arrange them. The list below is the correct order.</p>
      <ol className="space-y-3">
        {steps.map((step, index) => <li key={step.id}><ProcessStepCard step={step} index={index} style={style} showNumbers={false} accentColor={accentColor} presentation={presentation} decorative={decorative} mediaLayout={mediaLayout} renderTitle={renderTitle} renderBody={renderBody} renderMedia={renderMedia} ariaLive="off" /></li>)}
      </ol>
    </section>;

    const moveStep = (index: number, offset: -1 | 1) => {
      if (orderingCompleted || decorative) return;
      const target = index + offset;
      if (target < 0 || target >= orderingSteps.length) return;
      const nextSteps = [...orderingSteps];
      const [step] = nextSteps.splice(index, 1);
      nextSteps.splice(target, 0, step);
      setOrderingSteps(nextSteps);
      setOrderingFeedback(null);
    };
    const checkOrder = () => {
      if (orderingCompleted || orderingFeedback === "correct" || decorative) return;
      const correct = orderingSteps.every((step, index) => step.id === steps[index]?.id);
      setOrderingFeedback(correct ? "correct" : "incorrect");
      if (correct) onActivityComplete?.();
    };
    const completed = orderingCompleted || orderingFeedback === "correct";

    return <section aria-label="Order the process steps" data-process-activity="ordering" data-process-style={style} className="@container/process-steps mx-auto w-full min-w-0 max-w-3xl space-y-4" style={colors}>
      <div>
        <h3 className="text-lg font-semibold leading-snug text-slate-900">Put these steps in order</h3>
        <p className="mt-1 text-sm leading-6 text-slate-600">Use the move buttons to arrange the steps, then check your answer.</p>
      </div>
      <ol aria-label="Steps to arrange" className="space-y-3">
        {orderingSteps.map((step, index) => <li key={step.id} data-ordering-step-id={step.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <ProcessStepCard step={step} index={index} style={style} showNumbers={false} accentColor={accentColor} presentation={presentation} decorative={decorative} mediaLayout={mediaLayout} ariaLive="off" />
          <div className="grid gap-1">
            <Button type="button" variant="outline" size="icon" className="size-11" aria-label={`Move ${step.title || `step ${index + 1}`} up`} disabled={completed || decorative || index === 0} onClick={() => moveStep(index, -1)}><ArrowUp size={17} aria-hidden="true" /></Button>
            <Button type="button" variant="outline" size="icon" className="size-11" aria-label={`Move ${step.title || `step ${index + 1}`} down`} disabled={completed || decorative || index === orderingSteps.length - 1} onClick={() => moveStep(index, 1)}><ArrowDown size={17} aria-hidden="true" /></Button>
          </div>
        </li>)}
      </ol>
      <Button type="button" className="min-h-11 w-full sm:w-auto" disabled={completed || decorative} onClick={checkOrder} style={{ background: "var(--process-paint)", color: "var(--process-accent-text)" }}>Check order</Button>
      {orderingFeedback === "incorrect" && <p role="status" className="text-sm font-medium text-amber-800">Not quite yet. Reorder the steps and check again.</p>}
      {completed && <p role="status" className="text-sm font-medium text-emerald-700">Correct order. You can continue.</p>}
    </section>;
  }
  const previous: ProcessStepControl = { direction: "previous", label: previousLabel?.trim() || "Previous step", disabled: currentIndex === 0, onClick: () => selectStep(currentIndex - 1) };
  const next: ProcessStepControl = { direction: "next", label: nextLabel?.trim() || "Next step", disabled: currentIndex === steps.length - 1, onClick: () => selectStep(currentIndex + 1) };
  if (style === "slider") {
    const arrow = (control: ProcessStepControl) => renderControl ? renderControl(control) : <Button type="button" variant="outline" size="icon" className="size-11 min-h-11 shrink-0 whitespace-normal rounded-full" disabled={control.disabled || decorative} onClick={control.onClick} title={control.label}>
      {control.direction === "previous" ? <ChevronLeft size={20} aria-hidden="true" /> : <ChevronRight size={20} aria-hidden="true" />}
      <span className="sr-only">{control.label}</span>
    </Button>;
    return <section aria-label="Process steps" aria-roledescription="carousel" data-process-style={style} className="@container/process-steps mx-auto w-full min-w-0 space-y-3" style={colors}
      onKeyDown={(event) => {
        if (decorative || !(event.target instanceof HTMLElement) || (event.target !== event.currentTarget && event.target.tagName !== "BUTTON")) return;
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        selectStep(currentIndex + (event.key === "ArrowLeft" ? -1 : 1));
      }}>
      <div className="text-center">
        <span data-process-slider-number data-block-text-role="title" className="inline-flex min-h-11 items-center justify-center rounded-full px-5 py-2 text-xs font-semibold" style={{ background: "var(--process-paint)", color: "var(--process-accent-text)" }}>Step {currentIndex + 1} of {steps.length}</span>
        <Progress value={((currentIndex + 1) / steps.length) * 100} aria-label="Process step progress" aria-valuetext={`Step ${currentIndex + 1} of ${steps.length}`} className="mx-auto mt-3 min-w-0 max-w-sm [&>div]:[background:var(--process-paint)] [&>div]:motion-reduce:transition-none" />
      </div>
      <div data-process-slider className="process-slider-layout min-w-0">
        <div data-process-slider-control="previous">{!previous.disabled && arrow(previous)}</div>
        <div data-process-slider-viewport className="min-w-0 overflow-hidden rounded-2xl">
          <div key={`${blockId}-${activeStep.id}`} data-process-slide-direction={slideDirection ?? undefined} className={!decorative && slideDirection ? `process-slider-enter-${slideDirection}` : undefined}>
            <ProcessStepCard step={activeStep} index={currentIndex} style={style} showNumbers={false} accentColor={accentColor} presentation={presentation} decorative={decorative} mediaLayout={mediaLayout} renderTitle={renderTitle} renderBody={renderBody} renderMedia={renderMedia} />
          </div>
        </div>
        <div data-process-slider-control="next">{!next.disabled && arrow(next)}</div>
      </div>
    </section>;
  }
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
        <ProcessStepCard key={`${blockId}-${activeStep.id}`} step={activeStep} index={currentIndex} style={style} showNumbers={showNumbers} accentColor={accentColor} presentation={presentation} decorative={decorative} mediaLayout={mediaLayout} renderTitle={renderTitle} renderBody={renderBody} renderMedia={renderMedia} />
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-3 @min-[20rem]/process-steps:grid-cols-2">
        {renderControl ? renderControl(previous) : <Button type="button" variant="outline" className="min-h-11 w-full min-w-0 whitespace-normal" disabled={previous.disabled} onClick={previous.onClick}>{previous.label}</Button>}
        {(!next.disabled || renderControl) && (renderControl ? renderControl(next) : <Button type="button" className="min-h-11 w-full min-w-0 whitespace-normal" onClick={next.onClick} style={{ background: "var(--process-paint)", color: "var(--process-accent-text)" }}>{next.label}</Button>)}
      </div>
    </section>
  );
}
