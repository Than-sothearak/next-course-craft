"use client";

import { useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { resolveSlideHeader, type SlideHeader, type SlideMaster } from "@/lib/editor/slide-design";
import { SlideHeaderBackground } from "../../../_components/slide-presentation/slide-header-background";
import { MediaLibraryDialog } from "../media-library-dialog";
import { ColorPicker } from "@/components/ui/color-picker";
import { backgroundPaint, textPaint } from "@/lib/color";

export function SlideHeaderControls({ master, courseId, onChange }: { master: SlideMaster; courseId: string; onChange: (master: SlideMaster) => void }) {
  const header = resolveSlideHeader(master);
  const [imageOpen, setImageOpen] = useState(false);
  const update = (change: Partial<SlideHeader>) => onChange({ ...master, header: { ...header, ...change } });
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
      <SlideHeaderBackground master={master} /><span className="relative px-4 text-base font-semibold" style={textPaint(header.textColor ?? master.textColor)}>Slide title</span>
    </div>
    <MediaLibraryDialog courseId={courseId} kind="image" open={imageOpen} onClose={() => setImageOpen(false)} onSelect={(asset) => { update({ background: "image", imageSrc: asset.fileUrl }); setImageOpen(false); }} />
  </div>;
}
