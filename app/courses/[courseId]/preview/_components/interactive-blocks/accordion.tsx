"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "framer-motion";
import { ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ContentBlock } from "@/lib/schemas/block";
import { StatementTextPreview } from "@/app/courses/[courseId]/edit/_components/statement-text-preview";

type AccordionItem = Extract<ContentBlock, { type: "accordion" }>["data"]["items"][number];

function AccordionPanel({ id, labelledBy, tab = false, children }: { id: string; labelledBy: string; tab?: boolean; children: ReactNode }) {
  const present = useIsPresent();
  const reducedMotion = useReducedMotion();
  return <motion.div id={id} role={tab ? "tabpanel" : "region"} aria-labelledby={labelledBy} aria-hidden={!present || undefined} inert={!present}
    data-accordion-panel data-state={present ? "open" : "closing"}
    initial={tab ? { opacity: 0, y: 6 } : { height: 0, opacity: 0 }}
    animate={tab ? { opacity: 1, y: 0 } : { height: "auto", opacity: 1 }}
    exit={tab ? { opacity: 0, y: -4 } : { height: 0, opacity: 0 }}
    transition={{ duration: reducedMotion ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
    className={`min-w-0 overflow-hidden ${tab && !present ? "absolute inset-x-0 top-0" : ""}`}>
    <div className={tab ? "rounded-b-xl border border-t-0 border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700 sm:p-5" : "border-t border-slate-100 px-4 py-3 text-sm leading-6 text-slate-700 sm:px-5"}>{children}</div>
  </motion.div>;
}

export function InteractiveAccordion({ blockId, layout, displayMode, items, onItemInteract, renderTitle, renderBody }: {
  blockId: string;
  layout: "accordion" | "tabs";
  displayMode: "all" | "oneByOne";
  items: AccordionItem[];
  onItemInteract?: (itemId: string) => void;
  renderTitle?: (item: AccordionItem, index: number) => ReactNode;
  renderBody?: (item: AccordionItem, index: number) => ReactNode;
}) {
  const [activeItemId, setActiveItemId] = useState(items[0]?.id ?? "");
  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(() => new Set(items[0] ? [items[0].id] : []));
  const activeItem = items.find((item) => item.id === activeItemId) ?? items[0];
  function body(item: AccordionItem, index: number) {
    return renderBody ? renderBody(item, index) : item.bodyHtml !== undefined
      ? <StatementTextPreview tag="p" text={item.body} html={item.bodyHtml} className="prose max-w-none text-sm leading-6" />
      : <div className="whitespace-pre-wrap">{item.body || "Add an explanation for this section."}</div>;
  }
  function title(item: AccordionItem) {
    return item.titleHtml !== undefined ? <StatementTextPreview tag="p" text={item.title} html={item.titleHtml} className="text-sm font-semibold" /> : item.title || (layout === "tabs" ? "Untitled tab" : "Untitled section");
  }
  function openTab(id: string) { setActiveItemId(id); onItemInteract?.(id); }

  if (layout === "tabs") {
    return <div className="min-w-0">
      <div role="tablist" aria-label="Content sections" className="flex max-w-full gap-1 overflow-x-auto border-b border-slate-200" onKeyDown={(event) => {
        if (!(event.target instanceof HTMLElement) || event.target.getAttribute("role") !== "tab") return;
        const current = items.findIndex((item) => item.id === activeItem?.id);
        const target = event.key === "ArrowRight" ? (current + 1) % items.length : event.key === "ArrowLeft" ? (current - 1 + items.length) % items.length : event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : -1;
        if (target < 0) return;
        event.preventDefault(); event.stopPropagation();
        openTab(items[target].id);
        event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[target]?.focus();
      }}>
        {items.map((item, index) => {
          const selected = item.id === activeItem?.id;
          const trigger = <Button id={`${blockId}-tab-${item.id}`} variant="ghost" role="tab" aria-selected={selected} tabIndex={selected ? 0 : -1} aria-controls={`${blockId}-panel-${item.id}`} aria-label={renderTitle ? `Show section ${index + 1}` : item.title || "Untitled tab"} onClick={() => openTab(item.id)} className={`h-auto shrink-0 rounded-none border-b-2 px-3 py-2.5 text-sm font-medium sm:px-4 ${selected ? "border-[var(--course-primary,#2f5f9f)] text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
            {renderTitle ? <ChevronDown size={14} aria-hidden="true" /> : title(item)}
          </Button>;
          return renderTitle ? <div key={item.id} data-slide-animation-item className="flex shrink-0 items-center gap-1 pl-3"><div className="min-w-16">{renderTitle(item, index)}</div>{trigger}</div> : <div key={item.id} data-slide-animation-item>{trigger}</div>;
        })}
      </div>
      <div className="relative"><AnimatePresence initial={false}>{activeItem && <AccordionPanel key={activeItem.id} id={`${blockId}-panel-${activeItem.id}`} labelledBy={`${blockId}-tab-${activeItem.id}`} tab>{body(activeItem, items.indexOf(activeItem))}</AccordionPanel>}</AnimatePresence></div>
    </div>;
  }

  return <div className="space-y-2">
    {items.map((item, index) => {
      const expanded = displayMode === "all" ? expandedItemIds.has(item.id) : item.id === activeItemId;
      const toggle = () => {
        if (displayMode === "all") setExpandedItemIds((current) => { const next = new Set(current); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next; });
        else setActiveItemId(expanded ? "" : item.id);
        onItemInteract?.(item.id);
      };
      const icon = <Plus aria-hidden="true" size={18} className={`shrink-0 text-slate-400 transition-transform duration-200 motion-reduce:transition-none ${expanded ? "rotate-45" : ""}`} />;
      return <section key={item.id} data-slide-animation-item className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {renderTitle ? <div className="flex items-start gap-3 px-4 py-3 sm:px-5"><div className="min-w-0 flex-1">{renderTitle(item, index)}</div><Button id={`${blockId}-trigger-${item.id}`} variant="ghost" size="icon" className="size-7" aria-label={`${expanded ? "Collapse" : "Expand"} section ${index + 1}`} aria-expanded={expanded} aria-controls={`${blockId}-panel-${item.id}`} onClick={toggle}>{icon}</Button></div>
          : <Button id={`${blockId}-trigger-${item.id}`} variant="ghost" aria-expanded={expanded} aria-controls={`${blockId}-panel-${item.id}`} onClick={toggle} className="h-auto w-full justify-between gap-3 rounded-none px-4 py-3 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50 sm:px-5"><span className="min-w-0 flex-1">{title(item)}</span>{icon}</Button>}
        <AnimatePresence initial={false}>{expanded && <AccordionPanel key={item.id} id={`${blockId}-panel-${item.id}`} labelledBy={`${blockId}-trigger-${item.id}`}>{body(item, index)}</AccordionPanel>}</AnimatePresence>
      </section>;
    })}
  </div>;
}
