"use client";

import { useState } from "react";
import type { ContentBlock } from "@/lib/schemas/block";

type AccordionItem = Extract<ContentBlock, { type: "accordion" }>['data']['items'][number];


export function InteractiveAccordion({
  blockId,
  layout,
  displayMode,
  items,
  onItemInteract,
}: {
  blockId: string;
  layout: "accordion" | "tabs";
  displayMode: "all" | "oneByOne";
  items: AccordionItem[];
  onItemInteract?: (itemId: string) => void;
}) {
  const [activeItemId, setActiveItemId] = useState(items[0]?.id ?? "");
  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(
    () => new Set(items[0] ? [items[0].id] : []),
  );
  const activeItem = items.find((item) => item.id === activeItemId) ?? items[0];

  if (layout === "tabs") {
    return (
      <div className="min-w-0">
        <div role="tablist" aria-label="Content sections" className="flex max-w-full gap-1 overflow-x-auto border-b border-slate-200">
          {items.map((item) => {
            const selected = item.id === activeItem?.id;
            return (
              <button
                key={item.id}
                id={`${blockId}-tab-${item.id}`}
                data-slide-animation-item
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`${blockId}-panel-${item.id}`}
                onClick={() => { setActiveItemId(item.id); onItemInteract?.(item.id); }}
                className={`cursor-pointer shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors sm:px-4 ${selected ? "border-[var(--course-primary,#2f5f9f)] text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"}`}
              >
                {item.title || "Untitled tab"}
              </button>
            );
          })}
        </div>
        {activeItem && (
          <div
            id={`${blockId}-panel-${activeItem.id}`}
            role="tabpanel"
            aria-labelledby={`${blockId}-tab-${activeItem.id}`}
            className="rounded-b-xl border border-t-0 border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700 sm:p-5"
          >
            {activeItem.body || "Add an explanation for this section."}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const expanded = displayMode === "all"
          ? expandedItemIds.has(item.id)
          : item.id === activeItemId;
        return (
          <section key={item.id} data-slide-animation-item className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={`${blockId}-panel-${item.id}`}
              onClick={() => {
                if (displayMode === "all") {
                  setExpandedItemIds((current) => {
                    const next = new Set(current);
                    if (next.has(item.id)) next.delete(item.id);
                    else next.add(item.id);
                    return next;
                  });
                } else {
                  setActiveItemId(expanded ? "" : item.id);
                }
                onItemInteract?.(item.id);
              }}
              className="cursor-pointer flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50 sm:px-5"
            >
              <span>{item.title || "Untitled section"}</span>
              <span aria-hidden="true" className={`text-lg leading-none text-slate-400 transition-transform ${expanded ? "rotate-45" : ""}`}>+</span>
            </button>
            {expanded && (
              <div id={`${blockId}-panel-${item.id}`} className="border-t border-slate-100 px-4 py-3 text-sm leading-6 text-slate-700 sm:px-5">
                {item.body || "Add an explanation for this section."}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

