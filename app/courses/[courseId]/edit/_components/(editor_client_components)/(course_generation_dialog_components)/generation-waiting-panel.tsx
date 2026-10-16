import type { CSSProperties } from "react";
import { Check, Clock3, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { CourseGenerationProgressStage } from "../course-generation-dialog";
import styles from "./generation-waiting-panel.module.css";

const orbRings = Array.from({ length: 6 }, (_, index) => ({
  "--ring": index,
}) as CSSProperties);

export function GenerationWaitingPanel({
  stages,
  kind,
  elapsedSeconds,
  modelLabel,
}: {
  stages: CourseGenerationProgressStage[];
  kind: "prompt" | "source";
  elapsedSeconds: number;
  modelLabel: string;
}) {
  const elapsed = `${String(Math.floor(elapsedSeconds / 60)).padStart(2, "0")}:${String(elapsedSeconds % 60).padStart(2, "0")}`;
  const activeStage = stages.find((stage) => stage.status === "active");

  return (
    <section aria-label="AI generation in progress" className={`${styles.panel} flex min-h-full flex-col justify-center rounded-2xl border border-indigo-100/80 px-4 py-6 sm:px-5`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-indigo-600">
          <Sparkles size={13} aria-hidden="true" /> AI course generation
        </span>
        <Badge variant="outline" className="gap-1.5 border-indigo-100 bg-white/80 text-[10px] font-medium text-slate-600">
          <Clock3 size={11} aria-hidden="true" />
          <span className="tabular-nums">Elapsed {elapsed}</span>
        </Badge>
      </div>

      <div className="my-4 flex h-44 items-center justify-center" aria-hidden="true">
        <div className={styles.orb}>
          <span className={styles.glow} />
          <span className={styles.ripple} />
          <span className={`${styles.ripple} ${styles.delayedRipple}`} />
          <span className={styles.core} />
          {orbRings.map((style, index) => (
            <span key={index} className={styles.ring} style={style} />
          ))}
          <Sparkles className={styles.orbSparkle} size={25} strokeWidth={1.4} />
        </div>
      </div>

      <div className="text-center">
        <h3 className="text-xl font-semibold tracking-tight text-slate-900">Your course is taking shape</h3>
        <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-500">
          {kind === "prompt"
            ? "Turning your ideas into lessons, activities, and moments of discovery."
            : "Bringing your material to life with lessons and interactive activities."}
        </p>
      </div>

      <ol aria-label="Course generation progress" className="mt-7 space-y-3">
        {stages.map((stage) => {
          const active = stage.status === "active";
          const complete = stage.status === "complete";
          const value = stage.total === null ? null : stage.total === 0 ? 100 : (stage.completed / stage.total) * 100;
          return (
            <li key={stage.step} aria-current={active ? "step" : undefined}>
              <Card className={`rounded-xl p-3.5 shadow-none ${active ? "border-indigo-200 bg-white shadow-[0_4px_20px_-8px_rgba(99,102,241,0.2)]" : "border-slate-200/60 bg-white/50"}`}>
                <div className="flex items-start gap-3">
                  <span aria-hidden="true" className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg text-xs font-semibold ${complete ? "bg-emerald-50 text-emerald-600" : active ? "bg-indigo-50 text-indigo-600" : "bg-slate-100 text-slate-400"}`}>
                    {complete ? <Check size={16} /> : active ? (
                      <span className={styles.miniOrb} />
                    ) : stage.step}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Step {stage.step} of 2</p>
                    <div className="mt-0.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                      <h4 className={`text-sm font-semibold ${stage.status === "upcoming" ? "text-slate-500" : "text-slate-800"}`}>{stage.title}</h4>
                      <span className={`text-[10px] font-medium ${complete ? "text-emerald-600" : active ? "text-indigo-600" : "text-slate-400"}`}>
                        {complete ? "Complete" : active ? "In progress" : "Up next"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{stage.detail}</p>
                    {active && (
                      <div className="mt-3">
                        <Progress
                          value={value}
                          aria-label={`${stage.title} progress`}
                          className={`h-1 bg-indigo-50 ${value === null ? styles.indeterminate : ""}`}
                        />
                        {stage.total !== null && (
                          <div className="mt-1.5 flex justify-between gap-2 text-[10px] tabular-nums text-slate-500">
                            <span>{stage.completed} of {stage.total} steps</span>
                            <span>{Math.round(value ?? 0)}%</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </li>
          );
        })}
      </ol>

      <p role="status" aria-atomic="true" className="sr-only">{activeStage ? `${activeStage.title}. ${activeStage.detail}` : "Your course draft is ready"}</p>
      <div className="mt-6 border-t border-indigo-100/70 pt-4 text-center">
        <p className="text-xs leading-5 text-slate-500">Keep this window open. You’ll review the draft before adding it to your course.</p>
        <p className="mt-2 text-[10px] font-medium text-slate-400">Powered by {modelLabel}</p>
      </div>
    </section>
  );
}
