"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SlideNumberSettingInput } from "./slide-number-setting-input";
import { Select } from "@/components/ui/select";
import { resolveSlideSize, slideSizePresets, slideSizeSchema, type SlideMaster, type SlideSize } from "@/lib/editor/slide-design";

export function SlideCanvasSizeControls({ master, onChange }: { master: SlideMaster; onChange: (master: SlideMaster) => void }) {
  const size = resolveSlideSize(master);
  const [width, setWidth] = useState(size.width);
  const [height, setHeight] = useState(size.height);
  const [widthDraft, setWidthDraft] = useState<string | null>(null);
  const [heightDraft, setHeightDraft] = useState<string | null>(null);
  const [custom, setCustom] = useState(false);
  const preset = slideSizePresets.find((entry) => (entry.width === size.width && entry.height === size.height) || (entry.width === size.height && entry.height === size.width));
  const draft = slideSizeSchema.safeParse({ width: Number(widthDraft ?? width), height: Number(heightDraft ?? height) });
  const orientation = size.width >= size.height ? "landscape" : "portrait";

  function update(next: SlideSize) {
    setWidth(next.width); setHeight(next.height); setWidthDraft(null); setHeightDraft(null);
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
      <label className="space-y-1 text-xs text-slate-600">Width (px)<SlideNumberSettingInput aria-label="Slide width (px)" min={480} max={3840} value={width} onDraftChange={(text) => { setWidthDraft(text); setCustom(true); }} onValueChange={setWidth} /></label>
      <label className="space-y-1 text-xs text-slate-600">Height (px)<SlideNumberSettingInput aria-label="Slide height (px)" min={480} max={3840} value={height} onDraftChange={(text) => { setHeightDraft(text); setCustom(true); }} onValueChange={setHeight} /></label>
    </div>
    <p className="text-[11px] text-slate-500">480–3840 pixels per side. Applies to every slide.</p>
    <Button type="button" variant="outline" size="sm" className="w-full" disabled={!draft.success || (draft.data.width === size.width && draft.data.height === size.height)} onClick={() => { if (draft.success) update(draft.data); }}>Apply custom size</Button>
  </fieldset>;
}
