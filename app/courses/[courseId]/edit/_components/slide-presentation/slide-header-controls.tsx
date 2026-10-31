"use client";

import { useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { hasLegacySlideHeaderBackground, resolveSlideHeader, slideHeaderSchema, type SlideHeader, type SlideMaster } from "@/lib/editor/slide-design";
import { SlideHeaderBackground } from "../../../_components/slide-presentation/slide-header-background";
import { MediaLibraryDialog } from "../media-library-dialog";
import { ColorPicker } from "@/components/ui/color-picker";
import { backgroundPaint, textPaint } from "@/lib/color";
import { courseThemeFontFamilies, courseThemeFontFamilyIds } from "@/lib/editor/theme";
import { SlideNumberSettingInput } from "./slide-number-setting-input";

export function SlideHeaderControls({ master, courseId, onChange }: { master: SlideMaster; courseId: string; onChange: (master: SlideMaster) => void }) {
  const header = resolveSlideHeader(master);
  const legacyBackground = hasLegacySlideHeaderBackground(master.header);
  const [imageOpen, setImageOpen] = useState(false);
  const update = (change: Partial<SlideHeader>) => {
    const source = legacyBackground ? { ...master.header, backgroundColor: undefined } : master.header;
    const backgroundCustomized = change.backgroundColor ? true : source?.backgroundCustomized;
    onChange({ ...master, header: slideHeaderSchema.parse({ ...source, ...change, backgroundCustomized }) });
  };
  return <div aria-label="Slide header settings" className="space-y-3">
    <p className="text-xs leading-5 text-slate-500">Style the title area on content and quiz slides.</p>
    <label className="block space-y-1 text-xs text-slate-600">Background
      <Select aria-label="Header background style" value={header.background} onChange={(event) => update({ background: event.target.value as SlideHeader["background"] })}>
        <option value="transparent">Transparent</option><option value="color">Color</option><option value="image">Image</option>
      </Select>
    </label>
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1 text-xs text-slate-600">Background color<ColorPicker aria-label="Header background color" value={header.backgroundColor} onChange={(color) => update({ backgroundColor: color, background: header.background === "transparent" ? "color" : header.background })} /></div>
      <div className="space-y-1 text-xs text-slate-600">Title color<ColorPicker aria-label="Header text color" value={header.textColor ?? master.textColor} onChange={(color) => update({ textColor: color })} /></div>
    </div>
    {!legacyBackground && master.header?.backgroundColor && <Button variant="ghost" size="sm" onClick={() => update({ backgroundColor: undefined })}>Use theme header background</Button>}
    <div className="grid grid-cols-2 gap-2">
      <label className="text-xs text-slate-600">Title font<Select aria-label="Header font family" value={header.fontFamily ?? ""} className="mt-1" onChange={(event) => update({ fontFamily: event.target.value ? event.target.value as SlideHeader["fontFamily"] : undefined })}><option value="">Course font</option>{courseThemeFontFamilyIds.map((id) => <option key={id} value={id}>{id}</option>)}</Select></label>
      <label className="text-xs text-slate-600">Title size (px)<SlideNumberSettingInput aria-label="Header font size" min={12} max={72} value={header.fontSize} className="mt-1" onValueChange={(fontSize) => update({ fontSize })} /></label>
    </div>
    <div className="flex gap-3 text-xs text-slate-600">
      <label className="flex items-center gap-1"><Checkbox aria-label="Header bold" checked={header.fontWeight === "bold"} onChange={(event) => update({ fontWeight: event.target.checked ? "bold" : "normal" })} />Bold</label>
      <label className="flex items-center gap-1"><Checkbox aria-label="Header italic" checked={header.fontStyle === "italic"} onChange={(event) => update({ fontStyle: event.target.checked ? "italic" : "normal" })} />Italic</label>
    </div>
    {header.textColor && <Button variant="ghost" size="sm" onClick={() => update({ textColor: undefined })}>Use theme title color</Button>}
    {header.background === "image" && <>
      <Button variant="outline" size="sm" className="w-full" onClick={() => setImageOpen(true)}><ImagePlus size={14} aria-hidden="true" />{header.imageSrc ? "Replace header image" : "Choose or upload header image"}</Button>
      {header.imageSrc && <>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1 text-xs text-slate-600">Image position<Select aria-label="Header image position" value={header.imagePosition} onChange={(event) => update({ imagePosition: event.target.value as SlideHeader["imagePosition"] })}><option value="center">Center</option><option value="top">Top</option><option value="bottom">Bottom</option></Select></label>
          <label className="space-y-1 text-xs text-slate-600">Overlay (%)<Input type="number" aria-label="Header image overlay" min={0} max={90} value={header.overlayOpacity} onChange={(event) => { const value = event.target.valueAsNumber; if (Number.isInteger(value) && value >= 0 && value <= 90) update({ overlayOpacity: value }); }} /></label>
        </div>
        <Button variant="ghost" size="sm" className="text-rose-600" onClick={() => update({ imageSrc: "", background: "transparent" })}><Trash2 size={14} aria-hidden="true" />Remove header image</Button>
      </>}
    </>}
    <div aria-label="Header style preview" className="relative flex h-20 items-center overflow-hidden rounded-md border border-slate-200" style={backgroundPaint(master.backgroundColor)}>
      <SlideHeaderBackground master={master} /><span className="relative px-4" style={{ ...textPaint(header.textColor ?? master.textColor), fontFamily: header.fontFamily ? courseThemeFontFamilies[header.fontFamily] : undefined, fontSize: Math.min(header.fontSize, 32), fontWeight: header.fontWeight, fontStyle: header.fontStyle }}>Slide title</span>
    </div>
    <MediaLibraryDialog courseId={courseId} kind="image" open={imageOpen} onClose={() => setImageOpen(false)} onSelect={(asset) => { update({ background: "image", imageSrc: asset.fileUrl }); setImageOpen(false); }} />
  </div>;
}
