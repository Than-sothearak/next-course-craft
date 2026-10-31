"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { resolveSlideTextLayout, slideTextLayoutSchema } from "@/lib/editor/slide-design";
import type { ContentBlock } from "@/lib/schemas/block";

export function SlideTextLayoutControls({ block, onChange }: { block: ContentBlock; onChange: (block: ContentBlock) => void }) {
  const layout = resolveSlideTextLayout(block.slideTextLayout);
  function update(patch: Record<string, unknown>) {
    const parsed = slideTextLayoutSchema.safeParse({ ...layout, ...patch });
    if (parsed.success) onChange({ ...block, slideTextLayout: parsed.data });
  }
  return (
    <div className="space-y-3">
      <fieldset className="grid grid-cols-2 gap-2" aria-label="Text box alignment">
        <legend className="sr-only">Text alignment in box</legend>
        <label className="block text-xs text-slate-600">Horizontal
          <Select aria-label="Text box horizontal alignment" value={layout.horizontal ?? ""} onChange={(event) => update({ horizontal: event.target.value })} className="mt-1 h-9 text-xs">
          <option value="" disabled>Use text formatting</option>
          <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option><option value="justify">Justify</option>
          </Select>
        </label>
        <label className="block text-xs text-slate-600">Vertical
          <Select aria-label="Text box vertical alignment" value={layout.vertical} onChange={(event) => update({ vertical: event.target.value })} className="mt-1 h-9 text-xs">
          <option value="top">Top</option><option value="middle">Middle</option><option value="bottom">Bottom</option>
          </Select>
        </label>
      </fieldset>
      <fieldset className="grid grid-cols-2 gap-2" aria-label="Text box padding">
        <legend className="sr-only">Text box padding</legend>
        <label className="block text-xs text-slate-600">Horizontal padding (px)
          <Input aria-label="Text box horizontal padding" type="number" min={0} max={96} step={1} value={layout.paddingX} onChange={(event) => {
            const value = event.target.valueAsNumber;
            if (Number.isInteger(value) && value >= 0 && value <= 96) update({ paddingX: value });
          }} className="mt-1 h-9 text-xs" />
        </label>
        <label className="block text-xs text-slate-600">Vertical padding (px)
          <Input aria-label="Text box vertical padding" type="number" min={0} max={96} step={1} value={layout.paddingY} onChange={(event) => {
            const value = event.target.valueAsNumber;
            if (Number.isInteger(value) && value >= 0 && value <= 96) update({ paddingY: value });
          }} className="mt-1 h-9 text-xs" />
        </label>
      </fieldset>
      <label className="flex items-start gap-2 text-xs text-slate-600">
        <Checkbox aria-label="Fit text box to content" checked={layout.fitToText} onChange={(event) => update({ fitToText: event.target.checked })} />
        <span><span className="font-medium text-slate-700">Fit box to text</span><span className="mt-0.5 block text-[11px] leading-4 text-slate-500">Automatically size this box to its content, like a PowerPoint text box.</span></span>
      </label>
    </div>
  );
}
