"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { ColorPicker } from "@/components/ui/color-picker";
import { Select } from "@/components/ui/select";
import { courseThemeFontFamilyIds } from "@/lib/editor/theme";
import type { SlideTypography } from "@/lib/editor/slide-design";
import { SlideNumberSettingInput } from "./slide-number-setting-input";

const familyLabels: Record<(typeof courseThemeFontFamilyIds)[number], string> = {
  sans: "Sans serif", serif: "Serif", rounded: "Rounded", "noto-sans-khmer": "Noto Sans Khmer",
  battambang: "Battambang", "kantumruy-pro": "Kantumruy Pro", nokora: "Nokora",
};

export function SlideTypographyControls({ label, value, onChange, sizeRange = [10, 120] }: {
  label: string;
  value: SlideTypography;
  onChange: (value: SlideTypography) => void;
  sizeRange?: readonly [number, number];
}) {
  const update = (change: Partial<SlideTypography>) => onChange({ ...value, ...change });
  return <div className="space-y-2" aria-label={`${label} typography`}>
    <div className="grid grid-cols-2 gap-2">
      <label className="text-xs text-slate-600">Font family<Select aria-label={`${label} font family`} value={value.fontFamily ?? ""} className="mt-1" onChange={(event) => update({ fontFamily: event.target.value ? event.target.value as SlideTypography["fontFamily"] : undefined })}>
        <option value="">Course font</option>
        {courseThemeFontFamilyIds.map((id) => <option key={id} value={id}>{familyLabels[id]}</option>)}
      </Select></label>
      <label className="text-xs text-slate-600">Font size (px)<SlideNumberSettingInput aria-label={`${label} font size`} min={sizeRange[0]} max={sizeRange[1]} value={value.fontSize} className="mt-1" onValueChange={(fontSize) => update({ fontSize })} /></label>
    </div>
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-1.5 text-xs text-slate-600"><Checkbox aria-label={`${label} bold`} checked={value.fontWeight === "bold"} onChange={(event) => update({ fontWeight: event.target.checked ? "bold" : "normal" })} />Bold</label>
      <label className="flex items-center gap-1.5 text-xs text-slate-600"><Checkbox aria-label={`${label} italic`} checked={value.fontStyle === "italic"} onChange={(event) => update({ fontStyle: event.target.checked ? "italic" : "normal" })} />Italic</label>
      <label className="flex items-center gap-1.5 text-xs text-slate-600"><Checkbox aria-label={`${label} underline`} checked={value.textDecoration === "underline"} onChange={(event) => update({ textDecoration: event.target.checked ? "underline" : "none" })} />Underline</label>
    </div>
    <div className="grid grid-cols-2 gap-2">
      <label className="text-xs text-slate-600">Alignment<Select aria-label={`${label} alignment`} value={value.textAlign} className="mt-1" onChange={(event) => update({ textAlign: event.target.value as SlideTypography["textAlign"] })}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></Select></label>
      <div className="space-y-1 text-xs text-slate-600">Text color<ColorPicker aria-label={`${label} text color`} value={value.color} onChange={(color) => update({ color })} /></div>
    </div>
  </div>;
}
