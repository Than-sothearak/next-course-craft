"use client";

import { Checkbox } from "@/components/ui/checkbox";
import type { ContentBlock } from "@/lib/schemas/block";

export function SlidePlaybackControls({ block, onChange }: { block: ContentBlock; onChange: (block: ContentBlock) => void }) {
  if (block.type !== "video" && block.type !== "audio") return null;
  const settings = block.slidePlayback ?? { autoPlay: false, showControls: true };
  return <section aria-label="Presentation media playback settings" className="grid grid-cols-2 gap-2">
    <label className="flex items-start gap-2 rounded-md border border-slate-200 p-2 text-xs text-slate-600"><Checkbox aria-label="Autoplay media" checked={settings.autoPlay} onChange={(event) => onChange({ ...block, slidePlayback: { ...settings, autoPlay: event.target.checked } })} />Autoplay on open</label>
    <label className="flex items-start gap-2 rounded-md border border-slate-200 p-2 text-xs text-slate-600"><Checkbox aria-label="Show media player controls" checked={settings.showControls} onChange={(event) => onChange({ ...block, slidePlayback: { ...settings, showControls: event.target.checked } })} />Player controls</label>
    {block.type === "audio" && <label className="col-span-2 flex items-start gap-2 rounded-md border border-slate-200 p-2 text-xs text-slate-600"><Checkbox aria-label="Show audio file name" checked={block.slidePlayback?.showFileName ?? true} onChange={(event) => onChange({ ...block, slidePlayback: { ...settings, showFileName: event.target.checked } })} />Show file name</label>}
    <p className="col-span-2 text-xs leading-5 text-slate-500">Turning off player controls keeps timelines hidden, including after completion. Play and pause remain available. Applies to uploaded video and audio.</p>
  </section>;
}
