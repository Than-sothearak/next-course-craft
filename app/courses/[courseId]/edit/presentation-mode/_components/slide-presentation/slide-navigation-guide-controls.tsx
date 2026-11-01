"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { slideNavigationGuideSchema, type SlideMaster } from "@/lib/editor/slide-design";

export function SlideNavigationGuideControls({ master, onChange }: { master: SlideMaster; onChange: (master: SlideMaster) => void }) {
  const guide = master.navigationGuide ?? slideNavigationGuideSchema.parse({});
  return <div className="space-y-3">
    <label className="flex items-center gap-2 text-xs text-slate-600"><Checkbox aria-label="Enable navigation guide" checked={guide.enabled} onChange={(event) => onChange({ ...master, navigationGuide: { ...guide, enabled: event.target.checked } })} />Show navigation tips to learners</label>
    {guide.enabled && <>
      <label className="flex items-center gap-2 text-xs text-slate-600"><Checkbox aria-label="Navigation guide first visit only" checked={guide.firstVisitOnly} onChange={(event) => onChange({ ...master, navigationGuide: { ...guide, firstVisitOnly: event.target.checked } })} />First visit only</label>
      {(["nextText", "previousText", "restartText"] as const).map((field) => <label key={field} className="block space-y-1 text-xs text-slate-600">{field === "nextText" ? "Next button tip" : field === "previousText" ? "Previous button tip" : "Restart button tip"}<Textarea aria-label={field === "nextText" ? "Next button guide text" : field === "previousText" ? "Previous button guide text" : "Restart button guide text"} maxLength={300} value={guide[field]} className="min-h-16" onChange={(event) => { if (event.target.value.trim()) onChange({ ...master, navigationGuide: { ...guide, [field]: event.target.value } }); }} /></label>)}
      <p className="text-[11px] leading-4 text-slate-500">Tips appear on the first content slide. Use Navigation help beside the footer buttons to preview or replay the guide.</p>
    </>}
  </div>;
}
