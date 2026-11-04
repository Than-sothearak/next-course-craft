"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Select } from "@/components/ui/select";
import type { ContentBlock } from "@/lib/schemas/block";

export function SlidePlaybackControls({ block, onChange }: { block: ContentBlock; onChange: (block: ContentBlock) => void }) {
  if (block.type !== "video" && block.type !== "audio") return null;
  const settings = block.slidePlayback ?? { autoPlay: false, loop: false, muted: false, showControls: true };
  return <section aria-label="Presentation media playback settings" className="grid grid-cols-2 gap-2">
    <label className="flex items-start gap-2 rounded-md border border-slate-200 p-2 text-xs text-slate-600"><Checkbox aria-label="Autoplay media" checked={settings.autoPlay} onChange={(event) => onChange({ ...block, slidePlayback: { ...settings, autoPlay: event.target.checked } })} />Autoplay on open</label>
    <label className="flex items-start gap-2 rounded-md border border-slate-200 p-2 text-xs text-slate-600"><Checkbox aria-label="Loop media" checked={settings.loop ?? false} onChange={(event) => onChange({ ...block, slidePlayback: { ...settings, loop: event.target.checked } })} />Loop playback</label>
    <label className="flex items-start gap-2 rounded-md border border-slate-200 p-2 text-xs text-slate-600"><Checkbox aria-label="Mute media" checked={settings.muted ?? false} onChange={(event) => onChange({ ...block, slidePlayback: { ...settings, muted: event.target.checked } })} />Mute playback</label>
    <label className="flex items-start gap-2 rounded-md border border-slate-200 p-2 text-xs text-slate-600"><Checkbox aria-label="Show media player controls" checked={settings.showControls} onChange={(event) => onChange({ ...block, slidePlayback: { ...settings, showControls: event.target.checked } })} />Player controls</label>
    {block.type === "video" && <label className="col-span-2 grid gap-1 text-xs text-slate-600">When returning to this slide
      <Select aria-label="Video behavior when returning to slide" value={block.slidePlayback?.revisitBehavior ?? "restart"} onChange={(event) => onChange({ ...block, slidePlayback: { ...settings, revisitBehavior: event.target.value === "continue" ? "continue" : "restart" } })} className="h-9 text-xs">
        <option value="restart">Restart from beginning</option>
        <option value="continue">Continue from last position</option>
      </Select>
      <span className="leading-5 text-slate-500">Returning keeps the video paused. Autoplay applies on the first visit. Watched progress is preserved.</span>
    </label>}
    {block.type === "audio" && <label className="col-span-2 flex items-start gap-2 rounded-md border border-slate-200 p-2 text-xs text-slate-600"><Checkbox aria-label="Show audio file name" checked={block.slidePlayback?.showFileName ?? false} onChange={(event) => onChange({ ...block, slidePlayback: { ...settings, showFileName: event.target.checked } })} />Show file name</label>}
    <p className="col-span-2 text-xs leading-5 text-slate-500">Turning off player controls keeps timelines hidden, including after completion. Play and pause remain available. Applies to uploaded video and audio.</p>
  </section>;
}
