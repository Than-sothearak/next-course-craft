"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { slideCoverInstructionsSchema, type SlideCover, type SlideCoverInstructions } from "@/lib/editor/slide-design";

export function SlideCoverInstructionControls({ cover, onChange }: { cover: SlideCover; onChange: (cover: SlideCover) => void }) {
  const instructions = cover.instructions ?? slideCoverInstructionsSchema.parse({});
  const [noticeOpen, setNoticeOpen] = useState(false);
  const update = (change: Partial<SlideCoverInstructions>) => onChange({ ...cover, instructions: { ...instructions, ...change } });
  return <div className="space-y-3">
    <label className="flex items-center gap-2 text-xs text-slate-600"><Checkbox aria-label="Show cover notice" checked={instructions.noticeEnabled} onChange={(event) => update({ noticeEnabled: event.target.checked })} />Show a welcome notice</label>
    {instructions.noticeEnabled && <>
      <label className="block space-y-1 text-xs text-slate-600">Notice title<Input aria-label="Cover notice title" maxLength={120} value={instructions.noticeTitle} onChange={(event) => { if (event.target.value.trim()) update({ noticeTitle: event.target.value }); }} /></label>
      <label className="block space-y-1 text-xs text-slate-600">Instructions<Textarea aria-label="Cover notice text" maxLength={1000} value={instructions.noticeText} onChange={(event) => update({ noticeText: event.target.value })} className="min-h-20" /></label>
      <Select aria-label="Cover notice trigger" value={instructions.noticeTrigger} onChange={(event) => update({ noticeTrigger: event.target.value as "cover" | "start" })}><option value="cover">Show when the cover opens</option><option value="start">Show after clicking Start</option></Select>
      <label className="flex items-center gap-2 text-xs text-slate-600"><Checkbox aria-label="Show cover notice on first visit only" checked={instructions.firstVisitOnly} onChange={(event) => update({ firstVisitOnly: event.target.checked })} />First visit only</label>
      <Button variant="outline" size="sm" className="w-full" onClick={() => setNoticeOpen(true)}>Preview welcome notice</Button>
    </>}
    <Dialog open={noticeOpen} onClose={() => setNoticeOpen(false)} title={instructions.noticeTitle} footer={<Button onClick={() => setNoticeOpen(false)}>Got it</Button>}><p className="whitespace-pre-wrap text-sm leading-6">{instructions.noticeText}</p></Dialog>
  </div>;
}
