"use client";

import { useState, type ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NumberInput } from "@/components/ui/number-input";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ColorPicker } from "@/components/ui/color-picker";
import { createClientId } from "@/lib/client-id";
import { hangingRopeCardSchema, type ContentBlock, type HangingRopeCard, type RevealContentBlock } from "@/lib/schemas/block";
import { ropePhysicsPresets, type HangingRopeSettings } from "@/lib/schemas/hanging-rope-cards";
import { RevealContentEditor } from "./reveal-content-editor";

type Block = Extract<ContentBlock, { type: "hangingRopeCards" }>;
export function HangingRopeSettingsEditor({ block, courseId, onChange, renderContentEditor }: { block: Block; courseId: string; onChange: (block: ContentBlock) => void; renderContentEditor: (block: RevealContentBlock, change: (block: ContentBlock) => void) => ReactNode }) {
  const [selected, setSelected] = useState<string | undefined>(block.data.cards[0]?.id);
  const card = block.data.cards.find((item) => item.id === selected) ?? block.data.cards[0];
  const update = (changes: Partial<Block["data"]>) => onChange({ ...block, data: { ...block.data, ...changes } });
  const updateCard = (changes: Partial<HangingRopeCard>) => update({ cards: block.data.cards.map((item) => item.id === card.id ? { ...item, ...changes } : item) });
  const number = (key: "ropeLength" | "ropeThickness" | "springStiffness" | "damping" | "dragResistance" | "maxStretch" | "targetRadius" | "animationDuration", label: string, min: number, max: number) => <label className="space-y-1 text-xs text-slate-600">{label}<NumberInput aria-label={`Rope ${label.toLowerCase()}`} value={block.data[key]} min={min} max={max} precision={key === "animationDuration" ? 0 : 2} onValueChange={(value) => update({ [key]: value })} /></label>;
  return <div aria-label="Hanging Rope Cards settings" className="space-y-4">
    <label className="block space-y-1 text-xs text-slate-600">Title<Input aria-label="Rope block title" maxLength={160} value={block.data.title} onChange={(event) => update({ title: event.target.value })} /></label>
    <label className="block space-y-1 text-xs text-slate-600">Instructions<Textarea aria-label="Rope instructions" maxLength={500} value={block.data.instructions} onChange={(event) => update({ instructions: event.target.value })} /></label>
    <fieldset className="space-y-3"><legend className="mb-2 text-sm font-semibold">Cards & discoveries</legend>
      <div className="flex gap-1"><Select aria-label="Edit hanging card" value={card.id} onChange={(event) => setSelected(event.target.value)}>{block.data.cards.map((item, index) => <option key={item.id} value={item.id}>{index + 1}. {item.title || "Discovery"}</option>)}</Select><Button variant="ghost" size="icon" aria-label="Delete hanging card" disabled={block.data.cards.length === 1} onClick={() => { update({ cards: block.data.cards.filter((item) => item.id !== card.id) }); setSelected(block.data.cards.find((item) => item.id !== card.id)?.id); }}><Trash2 size={14} /></Button></div>
      <label className="block space-y-1 text-xs text-slate-600">Card title<Input aria-label="Rope card title" value={card.title} maxLength={160} onChange={(event) => updateCard({ title: event.target.value })} /></label>
      <label className="block space-y-1 text-xs text-slate-600">Card description<Textarea aria-label="Rope card description" value={card.description} maxLength={300} onChange={(event) => updateCard({ description: event.target.value })} /></label>
      <div className="space-y-1 text-xs text-slate-600">Card color<ColorPicker aria-label="Rope selected card color" allowGradient={false} value={card.color ?? block.data.cardColor} onChange={(color) => updateCard({ color })} />{card.color && <Button variant="ghost" size="sm" onClick={() => updateCard({ color: undefined })}>Use default card color</Button>}</div>
      <div className="grid grid-cols-2 gap-3"><label className="space-y-1 text-xs text-slate-600">Target left (%)<NumberInput aria-label="Rope target left" value={card.targetX} min={35} max={65} onValueChange={(targetX) => updateCard({ targetX })} /></label><label className="space-y-1 text-xs text-slate-600">Target top (%)<NumberInput aria-label="Rope target top" value={card.targetY} min={70} max={80} onValueChange={(targetY) => updateCard({ targetY })} /></label></div>
      <RevealContentEditor key={card.id} blocks={card.blocks} courseId={courseId} onChange={(blocks) => updateCard({ blocks })} renderContentEditor={renderContentEditor} />
      <Button variant="outline" size="sm" disabled={block.data.cards.length >= 6} onClick={() => { const next = hangingRopeCardSchema.parse({ id: createClientId(), title: `Discovery ${block.data.cards.length + 1}` }); next.blocks = next.blocks.map((item) => ({ ...item, id: createClientId() })); update({ cards: [...block.data.cards, next] }); setSelected(next.id); }}><Plus size={14} />Add hanging card ({block.data.cards.length}/6)</Button>
    </fieldset>
    <fieldset className="space-y-3"><legend className="mb-2 text-sm font-semibold">Appearance & behavior</legend>
      <div className="grid grid-cols-2 gap-3">{([{ key: "backgroundColor", label: "Background" }, { key: "cardColor", label: "Default card" }, { key: "textColor", label: "Card text" }, { key: "ropeColor", label: "Rope" }, { key: "accentColor", label: "Glowing point" }] as const).map(({ key, label }) => <label key={key} className="space-y-1 text-xs text-slate-600">{label}<ColorPicker aria-label={`Rope ${label.toLowerCase()} color`} allowGradient={false} value={block.data[key]} onChange={(value) => update({ [key]: value })} /></label>)}</div>
      <label className="block space-y-1 text-xs text-slate-600">Reveal behavior<Select aria-label="Rope reveal behavior" value={block.data.revealMode} onChange={(event) => update({ revealMode: event.target.value as HangingRopeSettings["revealMode"] })}><option value="flip">Flip card and show content</option><option value="open">Open content</option></Select></label>
      <label className="block space-y-1 text-xs text-slate-600">Physics preset<Select aria-label="Rope physics preset" value={block.data.physicsPreset} onChange={(event) => { const physicsPreset = event.target.value as HangingRopeSettings["physicsPreset"]; update({ physicsPreset, ...ropePhysicsPresets[physicsPreset] }); }}><option value="soft">Soft</option><option value="realistic">Realistic</option><option value="arcade">Arcade</option></Select></label>
      <div className="grid grid-cols-2 gap-3">{number("ropeLength", "Resting rope length", 60, 125)}{number("ropeThickness", "Rope thickness", 1, 8)}{number("springStiffness", "Spring stiffness", 40, 300)}{number("damping", "Damping", 4, 40)}{number("dragResistance", "Drag resistance", 0, .7)}{number("maxStretch", "Stretch allowance", 80, 260)}{number("targetRadius", "Target radius", 20, 52)}{number("animationDuration", "Reveal duration (ms)", 200, 4000)}</div>
      <label className="flex items-center gap-2 text-xs text-slate-600"><Checkbox checked={block.data.allowReplay} onChange={(event) => update({ allowReplay: event.target.checked })} />Allow replay</label><label className="flex items-center gap-2 text-xs text-slate-600"><Checkbox checked={block.data.showInstructions} onChange={(event) => update({ showInstructions: event.target.checked })} />Show instructions</label>
    </fieldset>
    <p className="text-xs leading-5 text-slate-500">Pull cards in the live preview to test the ropes. Preview play never records learner progress. Keyboard: focus a card and press Enter or Space for an automatic pull.</p>
  </div>;
}
