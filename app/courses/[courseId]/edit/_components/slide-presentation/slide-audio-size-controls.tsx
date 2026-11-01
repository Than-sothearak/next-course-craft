"use client";

import { Button } from "@/components/ui/button";
import { fitSlideFrame, minimumSlideAudioHeight, resolveSlideFrame, type SlideSize } from "@/lib/editor/slide-design";
import { defaultSlideAudioSize, slideAudioSizes, type SlideAudioSize } from "@/lib/editor/slide-audio";
import type { ContentBlock } from "@/lib/schemas/block";

export function SlideAudioSizeControls({ block, index, total, area, onChange }: {
  block: ContentBlock;
  index: number;
  total: number;
  area: SlideSize;
  onChange: (block: ContentBlock) => void;
}) {
  if (block.type !== "audio") return null;
  const frame = resolveSlideFrame(block, index, total, area);
  const size = block.slidePlayback?.audioSize ?? defaultSlideAudioSize;
  return <fieldset className="space-y-2">
    <legend className="text-xs font-medium text-slate-600">Audio size</legend>
    <div className="grid grid-cols-3 gap-1.5">
      {(Object.keys(slideAudioSizes) as SlideAudioSize[]).map((value) => {
        const { label, width } = slideAudioSizes[value];
        const selected = size === value && Math.abs(frame.width - width) < .01;
        return <Button key={value} type="button" size="sm" variant={selected ? "default" : "outline"} aria-label={`${label} audio size`} aria-pressed={selected} onClick={() => onChange({ ...block, slidePlayback: { autoPlay: false, showControls: true, ...block.slidePlayback, audioSize: value, fitHeight: true }, slideFrame: fitSlideFrame(frame, { width, x: Math.min(frame.x, 100 - width) }, minimumSlideAudioHeight) })}>{label}</Button>;
      })}
    </div>
    <p className="text-[11px] leading-4 text-slate-500">Changes the player width and height. Use Width below for a custom width.</p>
  </fieldset>;
}
