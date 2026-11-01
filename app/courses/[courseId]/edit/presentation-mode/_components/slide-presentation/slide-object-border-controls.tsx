"use client";

import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { defaultSlideBorderRadius } from "@/lib/editor/slide-design";
import { defaultSlideBorder, slideBorderSchema, slideShadowSchema, type SlideBorder } from "@/lib/editor/slide-object-appearance";
import type { ContentBlock } from "@/lib/schemas/block";
import { SlideNumberSettingInput } from "./slide-number-setting-input";

export function SlideObjectBorderControls({ block, onChange, onApplyBorderRadiusToAll }: {
  block: ContentBlock; onChange: (block: ContentBlock) => void; onApplyBorderRadiusToAll?: (radius: number) => void;
}) {
  const border = block.slideBorder ?? defaultSlideBorder;
  function update(change: Partial<SlideBorder>) {
    const parsed = slideBorderSchema.safeParse({ ...border, ...change });
    if (parsed.success) onChange({ ...block, slideBorder: parsed.data });
  }
  return <fieldset aria-label="Object border and shadow" className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
    <legend className="sr-only">Border and shadow</legend>
    <label className="space-y-1 text-xs text-slate-600">Border width (px)
      <SlideNumberSettingInput aria-label="Object border width" min={0} max={24} step={0.01} value={border.width} onValueChange={(width) => update({ width })} className="h-8" />
    </label>
    <label className="space-y-1 text-xs text-slate-600">Border radius (px)
      <SlideNumberSettingInput aria-label="Object border radius" min={0} max={100} step={0.01} value={block.slideBorderRadius ?? defaultSlideBorderRadius} onValueChange={(slideBorderRadius) => onChange({ ...block, slideBorderRadius })} className="h-8" />
    </label>
    <label className="space-y-1 text-xs text-slate-600">Border color
      <ColorPicker aria-label="Object border color" value={border.color} allowGradient={false} onChange={(color) => update({ color })} />
    </label>
    <label className="space-y-1 text-xs text-slate-600">Border style
      <Select aria-label="Object border style" value={border.style} onChange={(event) => update({ style: event.target.value as SlideBorder["style"] })} className="h-8 text-xs">
        <option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option><option value="double">Double</option>
      </Select>
    </label>
    <label className="col-span-2 space-y-2 text-xs text-slate-600">Border opacity (%)
      <Input type="range" aria-label="Object border opacity" min={0} max={100} step={1} value={border.opacity} onChange={(event) => update({ opacity: Number(event.target.value) })} className="h-5 w-full cursor-pointer border-0 p-0 shadow-none accent-indigo-600" />
      <SlideNumberSettingInput aria-label="Object border opacity percentage" min={0} max={100} value={border.opacity} onValueChange={(opacity) => update({ opacity })} className="h-8" />
    </label>
    <label className="col-span-2 space-y-1 text-xs text-slate-600">Shadow
      <Select aria-label="Object shadow" value={block.slideShadow ?? "none"} onChange={(event) => { const parsed = slideShadowSchema.safeParse(event.target.value); if (parsed.success) onChange({ ...block, slideShadow: parsed.data }); }} className="h-8 text-xs">
        <option value="none">None</option><option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option>
      </Select>
    </label>
    {onApplyBorderRadiusToAll && <Button type="button" variant="outline" size="sm" className="col-span-2 w-full" onClick={() => onApplyBorderRadiusToAll(block.slideBorderRadius ?? defaultSlideBorderRadius)}>Apply radius to all blocks</Button>}
    <Button type="button" variant="ghost" size="sm" className="col-span-2 w-full" onClick={() => onChange({ ...block, slideBorder: { ...defaultSlideBorder }, slideBorderRadius: 0, slideShadow: "none" })}>Reset border and shadow</Button>
  </fieldset>;
}
