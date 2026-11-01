"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Textarea } from "@/components/ui/textarea";
import { createClientId } from "@/lib/client-id";
import type { ContentBlock } from "@/lib/schemas/block";
import type { ArcherBalloon } from "@/lib/schemas/balloon-archer";

export function BalloonArcherSettings({ block, onChange }: { block: Extract<ContentBlock, { type: "balloonArcher" }>; onChange: (block: ContentBlock) => void }) {
  const update = (change: Partial<typeof block.data>) => onChange({ ...block, data: { ...block.data, ...change } });
  const updateBalloon = (id: string, change: Partial<ArcherBalloon>) => update({ balloons: block.data.balloons.map((balloon) => balloon.id === id ? { ...balloon, ...change } : balloon) });
  return <div aria-label="Balloon Archer settings" className="space-y-4">
    <label className="block space-y-1 text-xs text-slate-600">Game title<Input aria-label="Balloon Archer title" value={block.data.title} maxLength={160} onChange={(event) => update({ title: event.target.value })} /></label>
    <label className="block space-y-1 text-xs text-slate-600">Instructions<Textarea aria-label="Balloon Archer instructions" value={block.data.instructions} maxLength={500} onChange={(event) => update({ instructions: event.target.value })} /></label>
    <div className="grid grid-cols-2 gap-3">{([{ field: "backgroundColor", label: "Game background" }, { field: "balloonColor", label: "Default balloon" }, { field: "textColor", label: "Word text" }, { field: "bowColor", label: "Bow and arrow" }] as const).map(({ field, label }) => <div key={field} className="space-y-1 text-xs text-slate-600">{label}<ColorPicker aria-label={`Balloon Archer ${label.toLowerCase()} color`} allowGradient={false} value={block.data[field]} onChange={(color) => update({ [field]: color })} /></div>)}</div>
    <p className="text-xs leading-5 text-slate-500">Drag balloons in the game preview, or enter their positions below. Hidden explanations appear only after a hit. Preview play never records learner progress.</p>
    {block.data.balloons.map((balloon, index) => <fieldset key={balloon.id} className="space-y-3 rounded-lg border border-slate-200 p-3">
      <legend className="px-1 text-xs font-medium text-slate-700">Balloon {index + 1}</legend>
      <div className="flex items-center gap-2"><Input aria-label={`Balloon ${index + 1} word`} value={balloon.word} maxLength={40} placeholder="Word on balloon" onChange={(event) => updateBalloon(balloon.id, { word: event.target.value })} /><Button variant="ghost" size="icon" className="size-8 text-rose-600" aria-label={`Delete balloon ${index + 1}`} disabled={block.data.balloons.length === 1} onClick={() => update({ balloons: block.data.balloons.filter((item) => item.id !== balloon.id) })}><Trash2 size={14} aria-hidden="true" /></Button></div>
      <label className="block space-y-1 text-xs text-slate-600">Revealed explanation<Textarea aria-label={`Balloon ${index + 1} revealed text`} rows={3} maxLength={3000} value={balloon.content} onChange={(event) => updateBalloon(balloon.id, { content: event.target.value })} /></label>
      <div className="grid grid-cols-2 gap-2"><label className="space-y-1 text-xs text-slate-600">Left (%)<NumberInput aria-label={`Balloon ${index + 1} left position`} min={8} max={92} value={balloon.x} onValueChange={(x) => updateBalloon(balloon.id, { x })} /></label><label className="space-y-1 text-xs text-slate-600">Top (%)<NumberInput aria-label={`Balloon ${index + 1} top position`} min={12} max={64} value={balloon.y} onValueChange={(y) => updateBalloon(balloon.id, { y })} /></label></div>
      <div className="space-y-1 text-xs text-slate-600">Balloon color<ColorPicker aria-label={`Balloon ${index + 1} color`} allowGradient={false} value={balloon.color ?? block.data.balloonColor} onChange={(color) => updateBalloon(balloon.id, { color })} /></div>
      {balloon.color && <Button variant="ghost" size="sm" onClick={() => updateBalloon(balloon.id, { color: undefined })}>Use default balloon color</Button>}
    </fieldset>)}
    <Button variant="outline" size="sm" className="w-full" disabled={block.data.balloons.length >= 12} onClick={() => { const index = block.data.balloons.length; update({ balloons: [...block.data.balloons, { id: createClientId(), word: `Word ${index + 1}`, content: "Write the explanation revealed when this balloon pops.", x: 18 + index % 4 * 21, y: 16 + Math.floor(index / 4) * 20 }] }); }}><Plus size={14} aria-hidden="true" />Add balloon ({block.data.balloons.length}/12)</Button>
  </div>;
}
