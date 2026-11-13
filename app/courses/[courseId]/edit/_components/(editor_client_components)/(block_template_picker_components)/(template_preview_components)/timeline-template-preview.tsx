import type { TimelineBlock } from "@/lib/editor/timeline";

export function TimelineTemplatePreview({ style }: { style: TimelineBlock["data"]["style"] }) {
  return <div data-timeline-template={style} className="rounded-lg bg-slate-50 p-3">
    <div className={`relative flex gap-2 ${style === "horizontal" ? "flex-row" : "flex-col"}`}>
      <div aria-hidden="true" className={style === "horizontal" ? "absolute left-0 right-0 top-1.5 h-0.5" : "absolute bottom-0 left-1/2 top-0 w-0.5 -translate-x-1/2"} style={{ background: "var(--course-primary, #2f5f9f)" }} />
      {["Start", "Develop", "Today"].map((label, index) => <div key={label} className={`relative flex min-w-0 flex-1 gap-1 ${style === "horizontal" ? "flex-col items-center pt-4" : style === "vertical" ? `${index % 2 ? "justify-end" : "justify-start"}` : "justify-center pt-3"}`}>
        <div className={`relative rounded border border-slate-200 bg-white p-2 ${style === "vertical" ? "w-[45%]" : "w-full"}`}>
          <div className="text-[8px] font-semibold" style={{ color: "var(--course-primary, #2f5f9f)" }}>{label}</div><div className="mt-1 h-1.5 w-4/5 rounded bg-slate-200" /><div className="mt-1 h-1 w-3/5 rounded bg-slate-100" />
        </div>
      </div>)}
    </div>
  </div>;
}
