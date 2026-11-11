"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { defaultProcessMediaLayout } from "@/lib/editor/process-steps";
import { processMediaLayoutSchema, type ProcessMediaLayout } from "@/lib/schemas/block";

function DimensionInput({ field, value, onCommit }: { field: "width" | "height"; value: number; onCommit: (draft: string) => void }) {
  const [draft, setDraft] = useState(String(value));
  return <label className="space-y-1 text-xs text-slate-600">{field === "width" ? "Width (px)" : "Height (px)"}<Input aria-label={`Process media ${field}`} type="number" min={64} max={1600} step={1} value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={() => { onCommit(draft); setDraft(String(value)); }} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} /></label>;
}

export function ProcessMediaLayoutSettings({ value = defaultProcessMediaLayout, onChange }: { value?: ProcessMediaLayout; onChange: (layout: ProcessMediaLayout) => void }) {
  function commit(field: "width" | "height", draft: string) {
    const parsed = processMediaLayoutSchema.safeParse({ ...value, [field]: draft.trim() ? Number(draft) : NaN });
    if (parsed.success) onChange(parsed.data);
  }
  return <fieldset className="space-y-2 rounded-lg border border-slate-200 p-3">
    <legend className="px-1 text-xs font-semibold text-slate-600">Image and video size</legend>
    <p className="text-xs text-slate-500">Applies to every step. The frame scales down on smaller screens.</p>
    <div className="grid grid-cols-2 gap-2">
      <DimensionInput key={`width-${value.width}`} field="width" value={value.width} onCommit={(draft) => commit("width", draft)} />
      <DimensionInput key={`height-${value.height}`} field="height" value={value.height} onCommit={(draft) => commit("height", draft)} />
    </div>
    <label className="block space-y-1 text-xs text-slate-600">Media fit<Select aria-label="Process media fit" value={value.fit} onChange={(event) => { const parsed = processMediaLayoutSchema.safeParse({ ...value, fit: event.target.value }); if (parsed.success) onChange(parsed.data); }}><option value="contain">Contain (show entire media)</option><option value="cover">Cover (crop to fill)</option><option value="fill">Fill (stretch to fit)</option></Select></label>
    <label className="block space-y-1 text-xs text-slate-600">Focal point<Select aria-label="Process media focal point" value={value.position} onChange={(event) => { const parsed = processMediaLayoutSchema.safeParse({ ...value, position: event.target.value }); if (parsed.success) onChange(parsed.data); }}><option value="center">Center</option><option value="top">Top</option><option value="bottom">Bottom</option><option value="left">Left</option><option value="right">Right</option></Select></label>
  </fieldset>;
}
