"use client";

import { ColorPicker } from "@/components/ui/color-picker";
import { Checkbox } from "@/components/ui/checkbox";
import { defaultCourseTheme } from "@/lib/editor/theme";
import { normalizeHexColor } from "@/lib/editor/text-format";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClientId } from "@/lib/client-id";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { processStepsPresets } from "@/lib/editor/process-steps";
import type { ContentBlock, ProcessStepsStyle } from "@/lib/schemas/block";
import { ProcessStepMediaEditor } from "./process-step-media-editor";

type ProcessBlock = Extract<ContentBlock, { type: "processSteps" }>;

export function ProcessStepsSettings({ block, onChange, courseId }: { block: ProcessBlock; onChange: (block: ContentBlock) => void; courseId?: string }) {
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
        <label className="flex items-center gap-2 text-xs font-medium text-slate-600"><Checkbox aria-label="Use custom process step color" checked={Boolean(block.data.accentColor)} onChange={(event) => update({ accentColor: event.target.checked ? normalizeHexColor(getComputedStyle(event.currentTarget).getPropertyValue("--course-primary")) ?? defaultCourseTheme.primaryColor : undefined })} />Custom accent color</label>
        <div className="flex items-center gap-2">
          {block.data.accentColor && <ColorPicker id={`process-accent-${block.id}`} aria-label="Process step accent color" value={block.data.accentColor} onChange={(color) => update({ accentColor: color })} />}
          <Button type="button" variant="outline" size="sm" disabled={!block.data.accentColor} onClick={() => {
            const data = { ...block.data };
            delete data.accentColor;
            onChange({ ...block, data });
          }}>Use course color</Button>
        </div>
        {!block.data.accentColor && <p className="text-xs text-slate-500">Uses the course theme color.</p>}
      </div>
      <label className="block space-y-1 text-xs font-medium text-slate-600">
        <span>Numbered badges</span>
        <Select aria-label="Process step numbering" value={block.data.showNumbers === false ? "hide" : "show"} onChange={(event) => update({ showNumbers: event.target.value === "show" })}>
          <option value="show">Show numbers</option>
          <option value="hide">Hide numbers</option>
        </Select>
      </label>
      <label className="block space-y-1 text-xs font-medium text-slate-600"><span>Previous button</span><Input aria-label="Process previous button label" value={block.data.previousLabel ?? "Previous step"} maxLength={120} onChange={(event) => update({ previousLabel: event.target.value })} /></label>
      <label className="block space-y-1 text-xs font-medium text-slate-600"><span>Next button</span><Input aria-label="Process next button label" value={block.data.nextLabel ?? "Next step"} maxLength={120} onChange={(event) => update({ nextLabel: event.target.value })} /></label>
      {block.data.steps.map((step, index) => (
        <div key={step.id} className="space-y-2 rounded-lg border border-slate-200 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">Step {index + 1}</span>
            {block.data.steps.length > 2 && <Button type="button" variant="ghost" size="icon" aria-label={`Delete process step ${index + 1}`} onClick={() => update({ steps: block.data.steps.filter((entry) => entry.id !== step.id) })} className="size-8 text-slate-400 hover:text-rose-600"><Trash2 size={14} /></Button>}
          </div>
          <Input aria-label={`Process step ${index + 1} title`} value={step.title} maxLength={160} onChange={(event) => update({ steps: block.data.steps.map((entry) => entry.id === step.id ? { ...entry, title: event.target.value, titleHtml: undefined } : entry) })} placeholder="Step title (optional)" className="h-9" />
          <Textarea aria-label={`Process step ${index + 1} instructions`} value={step.body} maxLength={5000} onChange={(event) => update({ steps: block.data.steps.map((entry) => entry.id === step.id ? { ...entry, body: event.target.value, bodyHtml: undefined } : entry) })} placeholder="Instructions for this step" className="min-h-16 resize-y" />
          {courseId && <ProcessStepMediaEditor step={step} index={index} courseId={courseId} onChange={(media) => update({ steps: block.data.steps.map((entry) => entry.id === step.id ? { ...entry, media } : entry) })} />}
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" disabled={block.data.steps.length >= 20} onClick={() => update({ steps: [...block.data.steps, { id: createClientId(), title: "New step", body: "" }] })} className="w-full justify-center"><Plus size={14} /> Add step</Button>
    </div>
  );
}
