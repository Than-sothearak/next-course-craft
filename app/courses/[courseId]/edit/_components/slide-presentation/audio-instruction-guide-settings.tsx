"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { replaySlideObjectAnimations, slideAnimationOptions, type SlideAnimation } from "@/lib/editor/slide-animation";
import { defaultAudioInstructionGuide, fitAudioGuidePoint, fitAudioGuidePopup, type AudioInstructionGuide } from "@/lib/editor/audio-instruction-guide";
import { SlideNumberSettingInput } from "./slide-number-setting-input";

export function AudioInstructionGuideSettings({ id, value, onChange }: { id: string; value?: AudioInstructionGuide; onChange: (guide: AudioInstructionGuide) => void }) {
  const guide = value ?? defaultAudioInstructionGuide;
  const update = (change: Partial<AudioInstructionGuide>) => onChange({ ...guide, ...change });
  const animation = guide.animation ?? defaultAudioInstructionGuide.animation;
  const updateAnimation = (change: Partial<SlideAnimation>) => update({ animation: { ...animation, ...change } });
  return <fieldset className="space-y-3 rounded-lg border border-slate-200 p-3">
    <legend className="px-1 text-xs font-medium text-slate-700">Guide popup</legend>
    <label className="flex items-center gap-2 text-xs text-slate-600"><Checkbox aria-label="Audio instruction guide popup" checked={guide.enabled} onChange={(event) => update({ enabled: event.target.checked })} />Enable popup guide</label>
    {guide.enabled && <>
      <p className="text-[11px] leading-4 text-slate-500">Drag the point and text card on the canvas. Choose when students see the guide below.</p>
      <label className="block space-y-1 text-xs text-slate-600">Guide title<Input aria-label="Audio guide title" maxLength={120} value={guide.title} onChange={(event) => update({ title: event.target.value })} /></label>
      <label className="block space-y-1 text-xs text-slate-600">Explanation<Textarea aria-label="Audio guide explanation" maxLength={3000} rows={3} value={guide.text} onChange={(event) => update({ text: event.target.value })} /></label>
      <div className="space-y-3 rounded-md border border-slate-200 p-2">
        <label className="block space-y-1 text-xs text-slate-600">Show popup<Select aria-label="Audio guide timing" value={guide.timing ?? "with"} onChange={(event) => update({ timing: event.target.value as AudioInstructionGuide["timing"] })}><option value="before">Before audio</option><option value="with">With audio</option><option value="after">After audio</option></Select></label>
        <p className="text-[11px] leading-4 text-slate-500">{guide.timing === "before" ? "The popup appears after its delay. Narration starts when the entrance animation finishes." : guide.timing === "after" ? "The delay starts when narration ends. The popup stays until dismissed or you leave the slide." : "The delay starts when narration actually begins. Pausing or ending audio hides the popup."}</p>
        <label className="block space-y-1 text-xs text-slate-600">Popup animation<Select aria-label="Audio guide animation" value={animation.effect} onChange={(event) => updateAnimation({ effect: event.target.value as SlideAnimation["effect"] })}>{slideAnimationOptions.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</Select></label>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1 text-xs text-slate-600">Duration (ms)<SlideNumberSettingInput aria-label="Audio guide animation duration" value={animation.duration} min={100} max={2000} disabled={animation.effect === "none"} onValueChange={(duration) => updateAnimation({ duration })} /></label>
          <label className="space-y-1 text-xs text-slate-600">Popup delay (ms)<SlideNumberSettingInput aria-label="Audio guide popup delay" value={animation.delay} min={0} max={30000} onValueChange={(delay) => updateAnimation({ delay })} /></label>
        </div>
        <Button variant="outline" size="sm" className="w-full" aria-label="Preview audio guide animation" disabled={animation.effect === "none"} onClick={(event) => { const scope = event.currentTarget.closest('dialog, [aria-label="Presentation slide editor"]'); if (scope) replaySlideObjectAnimations(scope, `audio-guide-${id}`); }}><Play size={13} aria-hidden="true" />Preview popup animation</Button>
      </div>
      <div className="grid grid-cols-2 gap-2">{(["x", "y"] as const).map((field) => <label key={field} className="space-y-1 text-xs text-slate-600">Point {field === "x" ? "left" : "top"} (%)<SlideNumberSettingInput aria-label={`Audio guide point ${field === "x" ? "left" : "top"}`} value={Math.round(guide.point[field] * 100) / 100} min={0} max={100} step={0.01} onValueChange={(next) => update({ point: fitAudioGuidePoint({ ...guide.point, [field]: next }) })} /></label>)}</div>
      <div className="grid grid-cols-2 gap-2">{([{ field: "x", label: "left", min: 0, max: 100 - guide.popup.width }, { field: "y", label: "top", min: 0, max: 100 - guide.popup.height }, { field: "width", label: "width", min: 16, max: 100 - guide.popup.x }, { field: "height", label: "height", min: 16, max: 100 - guide.popup.y }] as const).map(({ field, label, min, max }) => <label key={field} className="space-y-1 text-xs text-slate-600">Popup {label} (%)<SlideNumberSettingInput aria-label={`Audio guide popup ${label}`} value={Math.round(guide.popup[field] * 100) / 100} min={min} max={max} step={0.01} onValueChange={(next) => update({ popup: fitAudioGuidePopup(guide.popup, { [field]: next }) })} /></label>)}</div>
      <div className="grid grid-cols-3 gap-2">{([{ field: "pointColor", label: "Point" }, { field: "backgroundColor", label: "Popup fill" }, { field: "textColor", label: "Text" }] as const).map(({ field, label }) => <div key={field} className="space-y-1 text-xs text-slate-600">{label}<ColorPicker aria-label={`Audio guide ${field}`} value={guide[field]} onChange={(color) => update({ [field]: color })} /></div>)}</div>
    </>}
  </fieldset>;
}
