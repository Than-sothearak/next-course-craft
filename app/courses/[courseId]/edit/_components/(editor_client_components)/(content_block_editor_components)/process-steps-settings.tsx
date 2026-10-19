"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClientId } from "@/lib/client-id";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { processStepsPresets } from "@/lib/editor/process-steps";
import type { ContentBlock, ProcessStepsStyle } from "@/lib/schemas/block";

type ProcessBlock = Extract<ContentBlock, { type: "processSteps" }>;

export function ProcessStepsSettings({ block, onChange }: { block: ProcessBlock; onChange: (block: ContentBlock) => void }) {
  const update = (data: Partial<ProcessBlock["data"]>) => onChange({ ...block, data: { ...block.data, ...data } });
  return (
    <div className="space-y-3">
      <label className="block space-y-1 text-xs font-medium text-slate-600">
        <span>Step style</span>
        <Select aria-label="Process step style" value={block.data.style ?? "cards"} onChange={(event) => update({ style: event.target.value as ProcessStepsStyle })}>
          {processStepsPresets.map((preset) => <option key={preset.style} value={preset.style}>{preset.title}</option>)}
        </Select>
      </label>
      <div className="space-y-1">
        <label className="block text-xs font-medium text-slate-600" htmlFor={`process-accent-${block.id}`}>Accent color</label>
        <div className="flex items-center gap-2">
          <Input id={`process-accent-${block.id}`} type="color" aria-label="Process step accent color" value={block.data.accentColor ?? "#2f5f9f"} onChange={(event) => update({ accentColor: event.target.value })} className="h-9 w-14 p-1" />
          <Button type="button" variant="outline" size="sm" disabled={!block.data.accentColor} onClick={() => {
            const data = { ...block.data };
            delete data.accentColor;
            onChange({ ...block, data });
          }}>Use course color</Button>
        </div>
      </div>
      <label className="block space-y-1 text-xs font-medium text-slate-600">
        <span>Numbered badges</span>
        <Select aria-label="Process step numbering" value={block.data.showNumbers === false ? "hide" : "show"} onChange={(event) => update({ showNumbers: event.target.value === "show" })}>
          <option value="show">Show numbers</option>
          <option value="hide">Hide numbers</option>
        </Select>
      </label>
      {block.data.steps.map((step, index) => (
        <div key={step.id} className="space-y-2 rounded-lg border border-slate-200 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">Step {index + 1}</span>
            {block.data.steps.length > 2 && <Button type="button" variant="ghost" size="icon" aria-label={`Delete process step ${index + 1}`} onClick={() => update({ steps: block.data.steps.filter((entry) => entry.id !== step.id) })} className="size-8 text-slate-400 hover:text-rose-600"><Trash2 size={14} /></Button>}
          </div>
          <Input aria-label={`Process step ${index + 1} title`} value={step.title} maxLength={160} onChange={(event) => update({ steps: block.data.steps.map((entry) => entry.id === step.id ? { ...entry, title: event.target.value } : entry) })} placeholder="Step title" className="h-9" />
          <Textarea aria-label={`Process step ${index + 1} instructions`} value={step.body} maxLength={5000} onChange={(event) => update({ steps: block.data.steps.map((entry) => entry.id === step.id ? { ...entry, body: event.target.value } : entry) })} placeholder="Instructions for this step" className="min-h-16 resize-y" />
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" disabled={block.data.steps.length >= 20} onClick={() => update({ steps: [...block.data.steps, { id: createClientId(), title: "New step", body: "" }] })} className="w-full justify-center"><Plus size={14} /> Add step</Button>
    </div>
  );
}
