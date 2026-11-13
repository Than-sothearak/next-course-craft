import type { BlockTemplate } from "../block-template-data";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { CSSProperties } from "react";

export function ProcessStepsTemplatePreview({
  data,
}: {
  data: NonNullable<BlockTemplate["processSteps"]>;
}) {
  const firstStep = data.steps[0];
  const style = data.style ?? "cards";
  const accent = data.accentColor ?? "var(--course-primary, #2f5f9f)";
  if (style === "slider") return <div data-process-template-style={style} className="space-y-2 p-2.5">
    <p className="text-center"><span className="inline-flex rounded-full px-2 py-1 text-[8px] font-semibold text-white" style={{ backgroundColor: accent }}>Step 1 of {data.steps.length}</span></p>
    <Progress value={100 / data.steps.length} aria-hidden="true" className="h-1 [&>div]:[background:var(--process-preview-accent)]" style={{ "--process-preview-accent": accent } as CSSProperties} />
    <div className="grid grid-cols-[16px_minmax(0,1fr)_16px] items-center gap-1">
      <ChevronLeft size={14} className="text-slate-400" aria-hidden="true" />
      <div className="space-y-1 rounded-lg border border-slate-200 bg-white p-2">
        <div className="h-10 rounded bg-slate-100" aria-hidden="true" />
        <p className="text-[10px] font-semibold text-slate-800">{firstStep?.title}</p>
        <p className="line-clamp-2 text-[8px] leading-3 text-slate-500">{firstStep?.body}</p>
      </div>
      <ChevronRight size={14} style={{ color: accent }} aria-hidden="true" />
    </div>
  </div>;
  return (
    <div
      data-process-template-style={style}
      className={`space-y-2 p-2.5 ${style === "minimal" ? "bg-white" : "rounded-lg border border-slate-200 bg-white"}`}
      style={
        style === "spotlight"
          ? { backgroundColor: `color-mix(in srgb, ${accent} 7%, white)`, borderTop: `3px solid ${accent}` }
          : undefined
      }
    >
      <div className="flex items-center justify-between gap-2 text-[8px] font-semibold uppercase tracking-wide text-slate-500">
        <span>Step 1 of {data.steps.length}</span>
        <span className="h-1.5 w-12 overflow-hidden rounded-full bg-slate-100">
          <span
            className="block h-full w-1/3 rounded-full"
            style={{ backgroundColor: accent }}
          />
        </span>
      </div>
      {style === "numbered" && (
        <div className="flex gap-2">
          {data.steps.map((step, index) => (
            <span
              key={step.id}
              className="grid size-4 place-items-center rounded-full border text-[8px]"
              style={
                index === 0
                  ? {
                      backgroundColor: accent,
                      color: "white",
                      borderColor: accent,
                    }
                  : undefined
              }
            >
              {index + 1}
            </span>
          ))}
        </div>
      )}
      <div
        className={
          style === "timeline" ? "grid grid-cols-[48px_1fr] gap-2" : ""
        }
      >
        {style === "timeline" && (
          <div
            className="space-y-1 border-l-2 pl-1"
            style={{ borderColor: accent }}
          >
            {data.steps.map((step, index) => (
              <p
                key={step.id}
                className="m-0 truncate text-[7px] text-slate-500"
              >
                {index + 1}. {step.title}
              </p>
            ))}
          </div>
        )}
        <div>
          <p className="m-0 text-[10px] font-semibold text-slate-800">
            {firstStep?.title}
          </p>
          <p className="m-0 line-clamp-2 text-[8px] leading-3 text-slate-500">
            {firstStep?.body}
          </p>
        </div>
      </div>
      <div className="flex justify-end">
        <span
          className="rounded-full px-2 py-1 text-[7px] font-semibold text-white"
          style={{ backgroundColor: accent }}
        >
          Next step →
        </span>
      </div>
    </div>
  );
}
