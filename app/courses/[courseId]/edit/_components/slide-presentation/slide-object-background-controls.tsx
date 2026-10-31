"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { defaultSlideBorderRadius, resolveSlideBackground, slideBorderRadiusSchema } from "@/lib/editor/slide-design";
import type { ContentBlock } from "@/lib/schemas/block";
import { ColorPicker } from "@/components/ui/color-picker";

export function SlideObjectBackgroundControls({ block, onChange, onApplyBorderRadiusToAll }: {
  block: ContentBlock;
  onChange: (block: ContentBlock) => void;
  onApplyBorderRadiusToAll?: (radius: number) => void;
}) {
  const background = resolveSlideBackground(block);
  const transparent = background.opacity === 0;
  function update(color: string, opacity: number) {
    onChange({ ...block, slideBackground: { color, opacity } });
  }
  return (
    <fieldset className="grid grid-cols-2 gap-3" aria-label="Object background">
      <legend className="sr-only">Background</legend>
      <div className="col-span-2 grid grid-cols-2 gap-2">
        <Button type="button" size="sm" variant={transparent ? "secondary" : "outline"} aria-pressed={transparent} onClick={() => update(background.color, 0)} className="flex-1">Transparent</Button>
        <Button type="button" size="sm" variant={!transparent ? "secondary" : "outline"} aria-pressed={!transparent} onClick={() => update(background.color, background.opacity || 100)} className="flex-1">Color</Button>
      </div>
      <label className="space-y-1 text-xs text-slate-600">
        Background color
        <ColorPicker aria-label="Object background color" value={background.color} onChange={(color) => update(color, background.opacity || 100)} allowGradient />
      </label>
      <label className="block space-y-1 text-xs text-slate-600">
        Border radius (px)
        <Input type="number" aria-label="Object border radius" min={0} max={100} step={0.01} value={Number((block.slideBorderRadius ?? defaultSlideBorderRadius).toFixed(2))} onChange={(event) => {
          const radius = slideBorderRadiusSchema.safeParse(Number(event.target.value));
          if (radius.success) onChange({ ...block, slideBorderRadius: radius.data });
        }} className="h-8" />
      </label>
      <label className="col-span-2 block space-y-2 text-xs text-slate-600">
        <span className="flex justify-between"><span>Background opacity</span><span>{background.opacity}%</span></span>
        <Input type="range" aria-label="Object background opacity" min={0} max={100} step={1} value={background.opacity} onChange={(event) => {
          const opacity = Number(event.target.value);
          if (Number.isInteger(opacity) && opacity >= 0 && opacity <= 100) update(background.color, opacity);
        }} className="h-5 w-full cursor-pointer border-0 p-0 shadow-none accent-indigo-600" />
      </label>
      {onApplyBorderRadiusToAll && <Button type="button" variant="outline" size="sm" className="col-span-2 w-full" title="Use this radius on every block in this presentation" onClick={() => onApplyBorderRadiusToAll(block.slideBorderRadius ?? defaultSlideBorderRadius)}>Apply radius to all blocks</Button>}
    </fieldset>
  );
}
