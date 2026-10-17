"use client";

import { useId } from "react";
import { Button } from "./button";
export function Tabs({ tabs, value, onChange, label }: { tabs: Array<{ id: string; label: string }>; value: string; onChange: (id: string) => void; label: string }) {
  const id = useId();
  return <div role="tablist" aria-label={label} className="flex gap-1 border-b border-slate-200 px-3 py-2">
    {tabs.map((tab, index) => <Button key={tab.id} id={`${id}-${tab.id}`} role="tab" aria-selected={value === tab.id} tabIndex={value === tab.id ? 0 : -1} size="sm" variant={value === tab.id ? "secondary" : "ghost"} className="flex-1 text-xs" onClick={() => onChange(tab.id)} onKeyDown={(event) => {
      let next = index;
      if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
      else if (event.key === "ArrowLeft") next = (index + tabs.length - 1) % tabs.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = tabs.length - 1;
      else return;
      event.preventDefault(); onChange(tabs[next].id); document.getElementById(`${id}-${tabs[next].id}`)?.focus();
    }}>{tab.label}</Button>)}
  </div>;
}
