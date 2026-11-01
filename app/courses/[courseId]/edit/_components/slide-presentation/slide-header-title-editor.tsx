"use client";

import { Input } from "@/components/ui/input";

/** Plain title editing preserves the lesson title used by navigation and exports. */
export function SlideHeaderTitleEditor({ title, selected, onSelect, onChange }: { title: string; selected: boolean; onSelect: () => void; onChange: (title: string) => void }) {
  return <Input aria-label="Slide title" data-slide-header-editor data-selected={selected || undefined} value={title} maxLength={160} onPointerDown={onSelect} onFocus={onSelect} onChange={(event) => { onSelect(); onChange(event.target.value); }} style={{ color: "inherit", fontFamily: "inherit", fontSize: "inherit", fontWeight: "inherit", fontStyle: "inherit", letterSpacing: "inherit", textAlign: "inherit", textDecoration: "inherit" }} className={`h-auto w-full rounded-sm border-0 bg-transparent px-0 py-0 leading-tight shadow-none outline-none placeholder:opacity-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 ${selected ? "ring-2 ring-inset ring-indigo-400" : "hover:ring-1 hover:ring-inset hover:ring-indigo-300"}`} placeholder="Slide title" />;
}
