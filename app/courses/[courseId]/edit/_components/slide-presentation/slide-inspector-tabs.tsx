"use client";

import { useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Image, Layers, PanelsTopLeft } from "lucide-react";
import { SlideInspectorSections } from "./slide-inspector-section";
import { GradientColorContext } from "@/components/ui/color-picker";

export type SlideInspectorTab = "master" | "object" | "cover";
const tabs = [
  { id: "master", label: "Master slide", icon: PanelsTopLeft },
  { id: "object", label: "Object block", icon: Layers },
  { id: "cover", label: "Cover page", icon: Image },
] as const;

export function SlideInspectorTabs({ value, onChange, master, cover, children }: {
  value?: SlideInspectorTab;
  onChange?: (value: SlideInspectorTab) => void;
  master: ReactNode;
  cover: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  const [localValue, setLocalValue] = useState<SlideInspectorTab>("object");
  const active = value ?? localValue;
  const select = (next: SlideInspectorTab) => { setLocalValue(next); onChange?.(next); };
  return <GradientColorContext.Provider value={true}><div data-slide-inspector className="space-y-2 text-xs [&_input]:text-xs [&_select]:text-xs [&_textarea]:text-xs [&_button]:text-xs [&_label]:text-xs">
    <div role="tablist" aria-label="Slide settings" className="sticky top-0 z-30 grid grid-cols-3 gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1">
      {tabs.map((tab, index) => <Button key={tab.id} type="button" role="tab" id={`${id}-${tab.id}-tab`} aria-controls={`${id}-${tab.id}-panel`} aria-selected={active === tab.id} tabIndex={active === tab.id ? 0 : -1} variant="ghost" size="sm" className="min-w-0 px-1 text-xs aria-selected:bg-white aria-selected:text-indigo-700 aria-selected:shadow-sm" onClick={() => select(tab.id)} onKeyDown={(event) => {
        const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : null;
        if (next === null) return;
        event.preventDefault();
        select(tabs[next].id);
        document.getElementById(`${id}-${tabs[next].id}-tab`)?.focus();
      }}><tab.icon size={14} strokeWidth={1.75} aria-hidden="true" className="shrink-0" />{tab.label}</Button>)}
    </div>
    {tabs.map((tab) => <div key={tab.id} role="tabpanel" id={`${id}-${tab.id}-panel`} aria-labelledby={`${id}-${tab.id}-tab`} hidden={active !== tab.id} className="space-y-3">
      <SlideInspectorSections label={tab.label}>{tab.id === "master" ? master : tab.id === "cover" ? cover : children}</SlideInspectorSections>
    </div>)}
  </div></GradientColorContext.Provider>;
}
