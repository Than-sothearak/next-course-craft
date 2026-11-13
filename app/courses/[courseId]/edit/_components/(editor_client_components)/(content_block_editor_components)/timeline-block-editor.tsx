"use client";

import type { Editor } from "@tiptap/react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { TimelineBlock } from "@/components/timeline-block";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ColorPicker } from "@/components/ui/color-picker";
import { createClientId } from "@/lib/client-id";
import { normalizeHexColor } from "@/lib/editor/text-format";
import { timelinePresets, type TimelineBlock as Block, type TimelineItem } from "@/lib/editor/timeline";
import { StatementTextEditor } from "../(text_editing_components)/statement-text-editor";

export function TimelineBlockEditor({ block, onChange, onEditorFocus }: { block: Block; onChange: (block: Block) => void; onEditorFocus?: (editor: Editor) => void }) {
  const update = (id: string, patch: Partial<TimelineItem>) => onChange({ ...block, data: { ...block.data, items: block.data.items.map((item) => item.id === id ? { ...item, ...patch } : item) } });
  return <TimelineBlock data={block.data}
    renderLabel={(item, index) => <StatementTextEditor id={`${block.id}-${item.id}-label`} label={`Edit timeline event ${index + 1} label`} tag="p" text={item.label} html={item.labelHtml} maxLength={120} placeholder="Event label or date" className="text-xs font-semibold" inheritColor onEditorFocus={onEditorFocus} onChange={(labelHtml, label) => update(item.id, { label, labelHtml })} />}
    renderTitle={(item, index) => <StatementTextEditor id={`${block.id}-${item.id}-title`} label={`Edit timeline event ${index + 1} title`} tag="h3" text={item.title} html={item.titleHtml} maxLength={160} placeholder="Event title" className="text-[20px] font-semibold leading-snug" onEditorFocus={onEditorFocus} onChange={(titleHtml, title) => update(item.id, { title, titleHtml })} />}
    renderBody={(item, index) => <StatementTextEditor id={`${block.id}-${item.id}-body`} label={`Edit timeline event ${index + 1} text`} tag="p" text={item.body} html={item.bodyHtml} maxLength={5000} multiline placeholder="Write about this event. Select text to format it." className="text-base leading-6" onEditorFocus={onEditorFocus} onChange={(bodyHtml, body) => update(item.id, { body, bodyHtml })} />}
  />;
}

export function TimelineBlockSettings({ block, onChange }: { block: Block; onChange: (block: Block) => void }) {
  const update = (patch: Partial<Block["data"]>) => onChange({ ...block, data: { ...block.data, ...patch } });
  const edit = (id: string, patch: Partial<TimelineItem>) => update({ items: block.data.items.map((item) => item.id === id ? { ...item, ...patch } : item) });
  const move = (index: number, direction: number) => {
    const items = [...block.data.items];
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]];
    update({ items });
  };
  return <div className="space-y-3">
    <label className="block space-y-1 text-xs font-medium text-slate-600">Timeline layout<Select aria-label="Timeline layout" value={block.data.style} onChange={(event) => update({ style: event.target.value as Block["data"]["style"] })}>{timelinePresets.map((preset) => <option key={preset.style} value={preset.style}>{preset.title}</option>)}</Select></label>
    <label className="flex items-center gap-2 text-xs"><Checkbox checked={Boolean(block.data.accentColor)} onChange={(event) => update({ accentColor: event.target.checked ? normalizeHexColor(getComputedStyle(event.currentTarget).getPropertyValue("--course-primary")) ?? "#2f5f9f" : undefined })} />Custom timeline color</label>
    {block.data.accentColor && <ColorPicker id={`timeline-color-${block.id}`} aria-label="Timeline color" value={block.data.accentColor} onChange={(accentColor) => update({ accentColor })} />}
    {block.data.items.map((item, index) => <div key={item.id} className="space-y-2 rounded-lg border border-slate-200 p-3">
      <div className="flex items-center justify-between gap-2"><span className="text-xs text-slate-500">Event {index + 1}</span><div className="flex gap-1">
        <Button variant="ghost" size="icon" aria-label={`Move timeline event ${index + 1} up`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={14} /></Button>
        <Button variant="ghost" size="icon" aria-label={`Move timeline event ${index + 1} down`} disabled={index === block.data.items.length - 1} onClick={() => move(index, 1)}><ArrowDown size={14} /></Button>
        <Button variant="ghost" size="icon" aria-label={`Delete timeline event ${index + 1}`} disabled={block.data.items.length === 1} onClick={() => update({ items: block.data.items.filter((entry) => entry.id !== item.id) })}><Trash2 size={14} /></Button>
      </div></div>
      <Input aria-label={`Timeline event ${index + 1} label`} value={item.label} maxLength={120} placeholder="Label or date" onChange={(event) => edit(item.id, { label: event.target.value, labelHtml: undefined })} />
      <Input aria-label={`Timeline event ${index + 1} title`} value={item.title} maxLength={160} placeholder="Title" onChange={(event) => edit(item.id, { title: event.target.value, titleHtml: undefined })} />
      <Textarea aria-label={`Timeline event ${index + 1} text`} value={item.body} maxLength={5000} placeholder="Text" onChange={(event) => edit(item.id, { body: event.target.value, bodyHtml: undefined })} />
    </div>)}
    <Button variant="outline" size="sm" className="w-full" disabled={block.data.items.length >= 20} onClick={() => update({ items: [...block.data.items, { id: createClientId(), label: `Event ${block.data.items.length + 1}`, title: "New event", body: "" }] })}><Plus size={14} />Add timeline event</Button>
  </div>;
}
