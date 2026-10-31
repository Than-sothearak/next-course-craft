"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { resolveSlideSize, slideSizePresets, slideSizeSchema, type SlideMaster, type SlideSize } from "@/lib/editor/slide-design";

export function SlideCanvasSizeControls({ master, onChange }: { master: SlideMaster; onChange: (master: SlideMaster) => void }) {
  const size = resolveSlideSize(master);
  const [width, setWidth] = useState(String(size.width));
  const [height, setHeight] = useState(String(size.height));
  const [custom, setCustom] = useState(false);
  const preset = slideSizePresets.find((entry) => (entry.width === size.width && entry.height === size.height) || (entry.width === size.height && entry.height === size.width));
  const draft = slideSizeSchema.safeParse({ width: Number(width), height: Number(height) });
  const orientation = size.width >= size.height ? "landscape" : "portrait";

  function update(next: SlideSize) {
    setWidth(String(next.width)); setHeight(String(next.height));
    onChange({ ...master, size: next });
  }

  return <fieldset aria-label="Presentation slide size" className="space-y-3">
    <legend className="sr-only">Slide size</legend>
    <Select aria-label="Slide size preset" value={custom ? "custom" : preset?.id ?? "custom"} onChange={(event) => {
      if (event.target.value === "custom") { setCustom(true); return; }
      const next = slideSizePresets.find((entry) => entry.id === event.target.value);
      if (!next) return;
      setCustom(false);
      update(orientation === "portrait" ? { width: next.height, height: next.width } : { width: next.width, height: next.height });
    }}>
      {slideSizePresets.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
      <option value="custom">Custom size</option>
    </Select>
    <label className="block space-y-1 text-xs text-slate-600">Orientation
      <Select aria-label="Slide orientation" value={orientation} disabled={size.width === size.height} onChange={(event) => {
        const base = draft.success ? draft.data : size;
        const longer = Math.max(base.width, base.height); const shorter = Math.min(base.width, base.height);
        update(event.target.value === "portrait" ? { width: shorter, height: longer } : { width: longer, height: shorter });
      }}><option value="landscape">Landscape</option><option value="portrait">Portrait</option></Select>
    </label>
    <div className="grid grid-cols-2 gap-2">
      <label className="space-y-1 text-xs text-slate-600">Width (px)<Input type="number" aria-label="Slide width (px)" min={480} max={3840} step={1} value={width} onChange={(event) => { setWidth(event.target.value); setCustom(true); }} /></label>
      <label className="space-y-1 text-xs text-slate-600">Height (px)<Input type="number" aria-label="Slide height (px)" min={480} max={3840} step={1} value={height} onChange={(event) => { setHeight(event.target.value); setCustom(true); }} /></label>
    </div>
    <p className="text-[11px] text-slate-500">480–3840 pixels per side. Applies to every slide.</p>
    <Button type="button" variant="outline" size="sm" className="w-full" disabled={!draft.success || (draft.data.width === size.width && draft.data.height === size.height)} onClick={() => { if (draft.success) update(draft.data); }}>Apply custom size</Button>
  </fieldset>;
}
