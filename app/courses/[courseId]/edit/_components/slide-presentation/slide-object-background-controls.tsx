"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resolveSlideBackground } from "@/lib/editor/slide-design";
import type { ContentBlock } from "@/lib/schemas/block";
import { ColorPicker } from "@/components/ui/color-picker";
import { SlideNumberSettingInput } from "./slide-number-setting-input";

export function SlideObjectBackgroundControls({ block, onChange }: {
  block: ContentBlock;
  onChange: (block: ContentBlock) => void;
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
      <label className="col-span-2 space-y-1 text-xs text-slate-600">
        Background color
        <ColorPicker aria-label="Object background color" value={background.color} onChange={(color) => update(color, background.opacity || 100)} allowGradient />
      </label>
      <label className="col-span-2 block space-y-2 text-xs text-slate-600">
        <span className="flex justify-between"><span>Background opacity</span><span>{background.opacity}%</span></span>
        <Input type="range" aria-label="Object background opacity" min={0} max={100} step={1} value={background.opacity} onChange={(event) => {
          const opacity = Number(event.target.value);
          if (Number.isInteger(opacity) && opacity >= 0 && opacity <= 100) update(background.color, opacity);
        }} className="h-5 w-full cursor-pointer border-0 p-0 shadow-none accent-indigo-600" />
        <SlideNumberSettingInput aria-label="Object background opacity percentage" min={0} max={100} value={background.opacity} onValueChange={(opacity) => update(background.color, opacity)} className="h-8" />
      </label>
    </fieldset>
  );
}
