import { ArrowUpRight, Link2 } from "lucide-react";
import type { BlockTemplate } from "../block-template-data";

export function LinkTemplatePreview({ data }: { data: NonNullable<BlockTemplate["link"]> }) {
  const card = data.style === "card";
  const button = data.style === "button";
  const accent = "text-[var(--course-primary,#2f5f9f)]";

  return (
    <div
      data-template-link-preview={data.style}
      className={`flex min-w-0 items-center gap-2 ${card
        ? "rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
        : button
          ? "rounded-lg bg-[var(--course-primary,#2f5f9f)] px-3 py-2.5 text-center text-white shadow-sm"
          : accent}`}
    >
      {card && <span className={`grid size-7 shrink-0 place-items-center rounded-md bg-indigo-50 ${accent}`}><Link2 size={14} aria-hidden="true" /></span>}
      <span className="min-w-0 flex-1">
        <span data-template-link-label className={`block truncate text-[11px] font-semibold leading-4 ${data.style === "text" ? "underline decoration-1 underline-offset-2" : ""}`}>{data.label || "Open resource"}</span>
        {data.description && <span data-template-link-description className={`mt-0.5 line-clamp-2 text-[10px] font-normal leading-3.5 ${button ? "text-white/85" : "text-slate-500"}`}>{data.description}</span>}
      </span>
      <ArrowUpRight size={12} aria-hidden="true" className={`shrink-0 ${button ? "text-white/85" : accent}`} />
    </div>
  );
}
