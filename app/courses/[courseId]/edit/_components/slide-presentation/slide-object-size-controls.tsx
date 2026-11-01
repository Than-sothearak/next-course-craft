"use client";

import { SlideNumberSettingInput } from "./slide-number-setting-input";
import { ArrowLeftToLine, ArrowUpToLine, MoveHorizontal, MoveVertical, RotateCw } from "lucide-react";
import { minimumSlideAudioHeight, resolveSlideFrame, resolveSlideTextLayout, slideObjectArea, type SlideSize } from "@/lib/editor/slide-design";
import { resizeSlideObjectFrame } from "@/lib/editor/slide-objects";
import { normalizeSlideRotation } from "@/lib/editor/slide-transform";
import type { ContentBlock } from "@/lib/schemas/block";

export function SlideObjectSizeControls({ block, index, total, area = slideObjectArea, onChange }: {
  block: ContentBlock;
  index: number;
  total: number;
  area?: SlideSize;
  onChange: (block: ContentBlock) => void;
}) {
  const frame = resolveSlideFrame(block, index, total, area);
  const fields = [
    { key: "x", label: "Left", icon: ArrowLeftToLine, extent: area.width, min: 0 },
    { key: "y", label: "Top", icon: ArrowUpToLine, extent: area.height, min: 0 },
    { key: "width", label: "Width", icon: MoveHorizontal, extent: area.width, min: Number((area.width * 0.05).toFixed(2)) },
    { key: "height", label: "Height", icon: MoveVertical, extent: area.height, min: Number((area.height * (block.type === "audio" ? minimumSlideAudioHeight / 100 : .05)).toFixed(2)) },
  ] as const;
  return <div role="group" aria-label="Object position and size" className="grid grid-cols-2 gap-2">
    {fields.map(({ key, label, icon: Icon, extent, min }) => <label key={key} className="text-xs text-slate-600">
      <span className="flex items-center gap-1.5"><Icon size={13} strokeWidth={1.75} aria-hidden="true" className="text-slate-400" />{label} <span className="ml-auto text-[10px] text-slate-400">px</span></span>
      <SlideNumberSettingInput aria-label={`${label} (px)`} min={min} max={extent} step={0.01} value={Number((frame[key] * extent / 100).toFixed(2))} onValueChange={(pixels) => {
        const next = { ...block, slideFrame: resizeSlideObjectFrame(block, frame, { [key]: pixels / extent * 100 }, area) };
        if ((key === "width" || key === "height") && (block.type === "heading" || block.type === "richText" || block.type === "statement")) {
          next.slideTextLayout = { ...resolveSlideTextLayout(block.slideTextLayout), fitToText: false };
        }
        if (key === "height" && next.type === "audio") {
          next.slidePlayback = { autoPlay: false, showControls: true, ...next.slidePlayback, fitHeight: false };
        }
        onChange(next);
      }} className="mt-1 h-8" />
    </label>)}
    <label className="col-span-2 text-xs text-slate-600">
      <span className="flex items-center gap-1.5"><RotateCw size={13} strokeWidth={1.75} aria-hidden="true" className="text-slate-400" />Rotation <span className="ml-auto text-[10px] text-slate-400">degrees</span></span>
      <SlideNumberSettingInput aria-label="Object rotation (degrees)" min={0} max={360} step={1} value={frame.rotation ?? 0} onValueChange={(rotation) => onChange({ ...block, slideFrame: { ...frame, rotation: normalizeSlideRotation(rotation) } })} className="mt-1 h-8" />
    </label>
  </div>;
}
