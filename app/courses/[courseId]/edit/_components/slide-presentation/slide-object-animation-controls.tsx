"use client";

import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { defaultSlideAnimation, replaySlideObjectAnimations, slideAnimationOptions, type SlideAnimation } from "@/lib/editor/slide-animation";
import type { ContentBlock } from "@/lib/schemas/block";
import { SlideNumberSettingInput } from "./slide-number-setting-input";

export function SlideObjectAnimationControls({ block, onChange }: { block: ContentBlock; onChange: (block: ContentBlock) => void }) {
  const animation = block.slideAnimation ?? defaultSlideAnimation;
  const update = (change: Partial<SlideAnimation>) => onChange({ ...block, slideAnimation: { ...animation, ...change } });
  return <div className="space-y-3">
    <label className="block space-y-1 text-xs text-slate-600">Entrance animation<Select aria-label="Object entrance animation" value={animation.effect} onChange={(event) => update({ effect: event.target.value as SlideAnimation["effect"] })}>{slideAnimationOptions.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</Select></label>
    <div className="grid grid-cols-2 gap-2">
      <label className="space-y-1 text-xs text-slate-600">Duration (ms)<SlideNumberSettingInput aria-label="Object animation duration" min={100} max={2000} value={animation.duration} disabled={animation.effect === "none"} onValueChange={(duration) => update({ duration })} /></label>
      <label className="space-y-1 text-xs text-slate-600">Delay (ms)<SlideNumberSettingInput aria-label="Object animation delay" min={0} max={3000} value={animation.delay} disabled={animation.effect === "none"} onValueChange={(delay) => update({ delay })} /></label>
    </div>
    <div className="flex items-center justify-between gap-3"><p className="text-[11px] leading-4 text-slate-500">Plays on entry. Lists and collections reveal items in sequence.</p><Button variant="outline" size="sm" disabled={animation.effect === "none"} aria-label="Preview object animation" onClick={(event) => { const scope = event.currentTarget.closest('dialog, [aria-label="Presentation slide editor"]'); if (scope) replaySlideObjectAnimations(scope, block.id); }}><Play size={13} aria-hidden="true" />Preview</Button></div>
  </div>;
}
