"use client";

import { Select } from "@/components/ui/select";
import { slideTextLayoutSchema } from "@/lib/editor/slide-design";
import type { ContentBlock } from "@/lib/schemas/block";

export function SlideTextLayoutControls({ block, onChange }: { block: ContentBlock; onChange: (block: ContentBlock) => void }) {
  function update(field: "horizontal" | "vertical", value: string) {
    const parsed = slideTextLayoutSchema.safeParse({ ...block.slideTextLayout, [field]: value });
    if (parsed.success) onChange({ ...block, slideTextLayout: parsed.data });
  }
  return (
    <fieldset className="grid grid-cols-2 gap-2" aria-label="Text box alignment">
      <legend className="sr-only">Text alignment in box</legend>
      <label className="block text-xs text-slate-600">Horizontal
        <Select aria-label="Text box horizontal alignment" value={block.slideTextLayout?.horizontal ?? ""} onChange={(event) => update("horizontal", event.target.value)} className="mt-1 h-9 text-xs">
          <option value="" disabled>Use text formatting</option>
          <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option><option value="justify">Justify</option>
        </Select>
      </label>
      <label className="block text-xs text-slate-600">Vertical
        <Select aria-label="Text box vertical alignment" value={block.slideTextLayout?.vertical ?? "top"} onChange={(event) => update("vertical", event.target.value)} className="mt-1 h-9 text-xs">
          <option value="top">Top</option><option value="middle">Middle</option><option value="bottom">Bottom</option>
        </Select>
      </label>
    </fieldset>
  );
}
