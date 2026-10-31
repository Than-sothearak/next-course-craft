"use client";

import { createContext, useContext, useId, useState, type ReactNode } from "react";
import { ChevronDown, ChevronsDownUp, ChevronsUpDown, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

const SectionsContext = createContext<{
  expanded: boolean;
  overrides: Record<string, boolean>;
  toggle: (id: string, open: boolean) => void;
} | null>(null);

export function SlideInspectorSections({ label, children }: { label: string; children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const setAll = (open: boolean) => { setExpanded(open); setOverrides({}); };
  return <SectionsContext.Provider value={{ expanded, overrides, toggle: (id, open) => setOverrides((current) => ({ ...current, [id]: open })) }}>
    <div className="flex items-center justify-between px-1 text-xs">
      <span className="font-medium text-slate-500">{label} settings</span>
      <div className="flex gap-1">
        <Button variant="ghost" size="sm" className="min-h-7 gap-1 px-2 text-xs" aria-label={`Show all ${label} settings`} onClick={() => setAll(true)}><ChevronsUpDown size={13} aria-hidden="true" />Show all</Button>
        <Button variant="ghost" size="sm" className="min-h-7 gap-1 px-2 text-xs" aria-label={`Hide all ${label} settings`} onClick={() => setAll(false)}><ChevronsDownUp size={13} aria-hidden="true" />Hide all</Button>
      </div>
    </div>
    {children}
  </SectionsContext.Provider>;
}

export function SlideInspectorSection({ title, icon: Icon, children, actions, label }: {
  title: string;
  icon: LucideIcon;
  children: ReactNode;
  actions?: ReactNode;
  label?: string;
}) {
  const id = useId();
  const sections = useContext(SectionsContext);
  const [localOpen, setLocalOpen] = useState(false);
  const open = sections ? sections.overrides[id] ?? sections.expanded : localOpen;
  return <section data-inspector-section aria-label={label ?? title} className="min-w-0 rounded-lg border border-slate-200 bg-white">
    <div className="flex items-center gap-1 px-2">
      <Button variant="ghost" className="min-h-10 min-w-0 flex-1 justify-start gap-2 rounded-none px-1 text-xs font-semibold text-slate-700 hover:bg-transparent" aria-label={`Toggle ${title} settings`} aria-expanded={open} aria-controls={`${id}-content`} onClick={() => sections ? sections.toggle(id, !open) : setLocalOpen(!open)}>
        <Icon size={15} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-slate-500" />
        <span className="truncate">{title}</span>
        <ChevronDown size={14} aria-hidden="true" className={`ml-auto shrink-0 text-slate-400 transition-transform ${open ? "" : "-rotate-90"}`} />
      </Button>
      {actions}
    </div>
    <div id={`${id}-content`} data-inspector-section-content hidden={!open} className="space-y-3 border-t border-slate-100 p-3 text-xs">{children}</div>
  </section>;
}
