"use client";

import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NumberInput } from "@/components/ui/number-input";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ColorPicker } from "@/components/ui/color-picker";
import type { ContentBlock, RevealContentBlock } from "@/lib/schemas/block";
import { peelDirections, physicsPresets, type PeelSettings } from "@/lib/schemas/peel-to-reveal";
import { RevealContentEditor } from "./reveal-content-editor";

type PeelBlock = Extract<ContentBlock, { type: "peelToReveal" }>;

export function PeelSettingsEditor({ block, courseId, onChange, renderContentEditor }: { block: PeelBlock; courseId: string; onChange: (block: ContentBlock) => void; renderContentEditor: (block: RevealContentBlock, onChange: (block: ContentBlock) => void) => ReactNode }) {
  const update = (changes: Partial<PeelBlock["data"]>) => onChange({ ...block, data: { ...block.data, ...changes } });
  const numeric = (key: keyof PeelSettings, label: string, min: number, max: number) => <label className="block space-y-1 text-xs text-slate-600">{label}<NumberInput aria-label={`Peel ${label.toLowerCase()}`} min={min} max={max} precision={["cardWidth", "cardHeight", "animationDuration"].includes(key) ? 0 : 2} value={block.data[key] as number} onValueChange={(value) => update({ [key]: value })} /></label>;
  const toggle = (key: "autoComplete" | "allowReset" | "allowRepeat" | "showInstructions", label: string) => <label className="flex items-center gap-2 text-xs text-slate-600"><Checkbox checked={block.data[key]} onChange={(event) => update({ [key]: event.target.checked })} />{label}</label>;
  return <div aria-label="Peel to Reveal settings" className="space-y-4">
    <fieldset className="space-y-3"><legend className="mb-2 text-sm font-semibold">Paper & content</legend>
      <label className="block space-y-1 text-xs text-slate-600">Front title<Input aria-label="Peel front title" value={block.data.title} maxLength={160} onChange={(event) => update({ title: event.target.value })} /></label>
      <label className="block space-y-1 text-xs text-slate-600">Front instructions<Textarea aria-label="Peel instructions" value={block.data.instructions} maxLength={500} onChange={(event) => update({ instructions: event.target.value })} /></label>
      <p className="text-xs leading-5 text-slate-500">Test the peel on the canvas. Preview interactions never record learner progress. Change and combine the revealed content below.</p>
      <RevealContentEditor blocks={block.data.blocks} courseId={courseId} onChange={(blocks) => update({ blocks })} renderContentEditor={renderContentEditor} />
    </fieldset>
    <fieldset className="space-y-3"><legend className="mb-2 text-sm font-semibold">Appearance</legend>
      <div className="grid grid-cols-2 gap-3">{([{ key: "paperColor", label: "Paper" }, { key: "backgroundColor", label: "Reveal background" }, { key: "accentColor", label: "Accent" }] as const).map(({ key, label }) => <label key={key} className="space-y-1 text-xs text-slate-600">{label}<ColorPicker aria-label={`Peel ${label.toLowerCase()} color`} value={block.data[key]} allowGradient={false} onChange={(value) => update({ [key]: value })} /></label>)}</div>
      <label className="block space-y-1 text-xs text-slate-600">Material<Select aria-label="Peel material" value={block.data.material} onChange={(event) => update({ material: event.target.value as PeelSettings["material"] })}><option value="paper">Natural paper</option><option value="linen">Linen texture</option><option value="smooth">Smooth sticker</option></Select></label>
      <label className="block space-y-1 text-xs text-slate-600">Reveal corner<Select aria-label="Peel direction" value={block.data.direction} onChange={(event) => update({ direction: event.target.value as PeelSettings["direction"] })}>{peelDirections.map((direction) => <option key={direction} value={direction}>{direction.replace("-", " ")}</option>)}</Select></label>
      <label className="block space-y-1 text-xs text-slate-600">Grab indicator<Select aria-label="Peel grab indicator" value={block.data.indicator} onChange={(event) => update({ indicator: event.target.value as PeelSettings["indicator"] })}><option value="grip">Grip dots</option><option value="arrow">Arrow</option><option value="none">None</option></Select></label>
      <div className="grid grid-cols-2 gap-3">{numeric("cornerRadius", "Corner radius", 0, 64)}{numeric("thickness", "Paper thickness", 0, 8)}{numeric("shadowIntensity", "Shadow intensity", 0, 100)}{numeric("cardWidth", "Card width", 240, 1200)}{numeric("cardHeight", "Card height", 200, 1000)}</div>
      <p className="text-xs text-slate-500">Presentation objects use their slide frame. Standard cards use the dimensions above and grow with their content.</p>
    </fieldset>
    <fieldset className="space-y-3"><legend className="mb-2 text-sm font-semibold">Physics</legend>
      <label className="block space-y-1 text-xs text-slate-600">Preset<Select aria-label="Peel physics preset" value={block.data.physicsPreset} onChange={(event) => { const physicsPreset = event.target.value as PeelSettings["physicsPreset"]; update({ physicsPreset, ...physicsPresets[physicsPreset] }); }}><option value="soft">Soft</option><option value="realistic">Realistic</option><option value="arcade">Arcade</option></Select></label>
      <div className="grid grid-cols-2 gap-3">{numeric("dragResistance", "Drag resistance", 0, .85)}{numeric("springStiffness", "Spring stiffness", 40, 500)}{numeric("damping", "Damping", 4, 60)}{numeric("peelThreshold", "Reveal threshold", .2, .95)}{numeric("animationDuration", "Animation duration (ms)", 200, 4000)}</div>
      {toggle("autoComplete", "Automatically complete after threshold")}{toggle("allowReset", "Enable reset / replay")}{toggle("allowRepeat", "Allow repeated interaction")}
    </fieldset>
    <fieldset className="space-y-3"><legend className="mb-2 text-sm font-semibold">Interaction</legend>
      <label className="block space-y-1 text-xs text-slate-600">Trigger<Select aria-label="Peel trigger" value={block.data.trigger} onChange={(event) => update({ trigger: event.target.value as PeelSettings["trigger"] })}><option value="both">Drag and click / tap</option><option value="drag">Drag (keyboard supported)</option><option value="click">Click / tap</option></Select></label>
      {toggle("showInstructions", "Show interaction instructions")}
      <label className="flex items-center gap-2 text-xs text-slate-600"><Checkbox aria-label="Peel required for progress" checked={block.requiredForProgress !== false} onChange={(event) => onChange({ ...block, requiredForProgress: event.target.checked })} />Required for lesson progress</label>
    </fieldset>
  </div>;
}
