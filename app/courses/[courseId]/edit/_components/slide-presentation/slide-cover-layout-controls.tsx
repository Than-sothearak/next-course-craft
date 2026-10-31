"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { slideCoverPositions, slideCoverElementLayoutSchema, type SlideCover } from "@/lib/editor/slide-design";

const positionLabel = (position: string) => position === "middle-center" ? "center" : position.replace("-", " ");

export function SlideCoverLayoutControls({ cover, onChange }: { cover: SlideCover; onChange: (cover: SlideCover) => void }) {
  return <div className="space-y-4">
    <fieldset className="space-y-2"><legend className="text-xs font-medium text-slate-600">Content position</legend>
      <div className="grid grid-cols-3 gap-1.5">{slideCoverPositions.map((position) => <Button key={position} variant={(cover.contentPosition ?? "middle-center") === position ? "secondary" : "outline"} size="sm" aria-label={`Cover content ${positionLabel(position)}`} aria-pressed={(cover.contentPosition ?? "middle-center") === position} className="min-w-0 px-1 text-[11px] capitalize" onClick={() => onChange({ ...cover, contentPosition: position })}>{positionLabel(position)}</Button>)}</div>
    </fieldset>
    {(["titleLayout", "subtitleLayout", "buttonLayout"] as const).map((field) => {
      const label = field === "titleLayout" ? "Title" : field === "subtitleLayout" ? "Subtitle" : "Start button";
      const layout = cover[field];
      return <fieldset key={field} className="space-y-2 rounded-md border border-slate-200 p-2.5"><legend className="px-1 text-xs font-medium text-slate-600">{label}</legend>
        <Select aria-label={`${label} position`} value={layout?.position ?? "shared"} onChange={(event) => onChange({ ...cover, [field]: event.target.value === "shared" ? undefined : slideCoverElementLayoutSchema.parse({ ...layout, position: event.target.value }) })}>
          <option value="shared">Use content layout</option>{slideCoverPositions.map((position) => <option key={position} value={position}>{positionLabel(position)}</option>)}
        </Select>
        {layout && <div className="grid grid-cols-2 gap-2">{(["offsetX", "offsetY"] as const).map((axis) => <label key={axis} className="space-y-1 text-[11px] text-slate-500">{axis === "offsetX" ? "Horizontal offset" : "Vertical offset"} (px)<Input type="number" aria-label={`${label} ${axis === "offsetX" ? "horizontal" : "vertical"} offset`} min={-3840} max={3840} step={0.01} value={layout[axis]} onChange={(event) => { const next = slideCoverElementLayoutSchema.safeParse({ ...layout, [axis]: event.target.valueAsNumber }); if (next.success) onChange({ ...cover, [field]: next.data }); }} /></label>)}</div>}
      </fieldset>;
    })}
  </div>;
}
