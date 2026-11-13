"use client";

import type { CSSProperties, ReactNode } from "react";
import { solidColor } from "@/lib/color";
import type { TimelineBlock as Block, TimelineItem } from "@/lib/editor/timeline";
import { StatementTextPreview } from "@/app/courses/[courseId]/edit/_components/statement-text-preview";

export function TimelineBlock({ data, decorative = false, renderLabel, renderTitle, renderBody }: {
  data: Block["data"];
  decorative?: boolean;
  renderLabel?: (item: TimelineItem, index: number) => ReactNode;
  renderTitle?: (item: TimelineItem, index: number) => ReactNode;
  renderBody?: (item: TimelineItem, index: number) => ReactNode;
}) {
  return <section aria-label="Timeline" data-timeline-style={data.style} className="course-timeline @container/timeline w-full min-w-0" style={{
    "--timeline-paint": data.accentColor ?? "var(--course-primary, #2f5f9f)",
    "--timeline-accent": data.accentColor ? solidColor(data.accentColor) : "var(--course-primary, #2f5f9f)",
  } as CSSProperties}>
    <ol className="timeline-list" tabIndex={data.style === "horizontal" && !decorative ? 0 : undefined} aria-label="Timeline events">
      {data.items.map((item, index) => <li key={item.id} data-timeline-item={item.id} data-slide-animation-item className="timeline-item">
        <div className="timeline-marker" aria-hidden="true"><span /></div>
        <article className="timeline-card">
          {(renderLabel || item.label.trim()) && <div className="mb-2 text-xs font-semibold" style={{ color: "var(--timeline-accent)" }}>
            {renderLabel ? renderLabel(item, index) : <StatementTextPreview tag="p" text={item.label} html={item.labelHtml} className="text-xs font-semibold" />}
          </div>}
          {(renderTitle || item.title.trim()) && <div className="mb-2">
            {renderTitle ? renderTitle(item, index) : <StatementTextPreview tag="h3" text={item.title} html={item.titleHtml} className="text-[20px] font-semibold leading-snug" />}
          </div>}
          {renderBody ? renderBody(item, index) : <StatementTextPreview tag="p" text={item.body} html={item.bodyHtml} className="text-base leading-6 [&_.tiptap]:whitespace-pre-wrap" />}
        </article>
      </li>)}
    </ol>
  </section>;
}
