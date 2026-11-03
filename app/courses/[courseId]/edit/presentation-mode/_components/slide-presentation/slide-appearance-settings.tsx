"use client";

import { useState } from "react";
import { Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ColorPicker } from "@/components/ui/color-picker";
import { Select } from "@/components/ui/select";
import { defaultSlideAppearance, resolveSlideAppearanceMaster, resolveSlideNavigationVisibility, type SlideAppearance, type SlideMaster } from "@/lib/editor/slide-design";
import { SlideMasterBackground } from "@/app/courses/[courseId]/_components/slide-presentation/slide-master-background";
import { MediaLibraryDialog } from "@/app/courses/[courseId]/edit/_components/media-library-dialog";
import { SlideInspectorSection } from "./slide-inspector-section";
import { SlideNumberSettingInput } from "./slide-number-setting-input";

export function SlideAppearanceSettings({ value, onChange, master, courseId }: {
  value?: SlideAppearance;
  onChange: (value?: SlideAppearance) => void;
  master?: SlideMaster;
  courseId: string;
}) {
  const [imageOpen, setImageOpen] = useState(false);
  const appearance = value ?? defaultSlideAppearance, background = appearance.background;
  const change = (update: Partial<SlideAppearance>) => onChange({ ...appearance, ...update });
  return <SlideInspectorSection title="Slide background & layout" icon={ImageIcon} defaultOpen={false}>
    <div className="space-y-3" aria-label="Current slide appearance">
      <p className="text-xs text-slate-500">Applies only to this slide. Objects remain editable over the background.</p>
      <label className="flex items-center gap-2 text-xs text-slate-600"><Checkbox aria-label="Blank slide" checked={appearance.hideHeader && appearance.hideFooter} onChange={(event) => change({ hideHeader: event.target.checked, hideFooter: event.target.checked })} />Blank slide (hide header and footer)</label>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex items-center gap-2 text-xs text-slate-600"><Checkbox aria-label="Show slide header" checked={!appearance.hideHeader} onChange={(event) => change({ hideHeader: !event.target.checked })} />Show header</label>
        <label className="flex items-center gap-2 text-xs text-slate-600"><Checkbox aria-label="Show slide footer" checked={!appearance.hideFooter} onChange={(event) => change({ hideFooter: !event.target.checked })} />Show footer</label>
      </div>
      <label className="flex items-center gap-2 text-xs text-slate-600"><Checkbox aria-label="Show navigation buttons" checked={resolveSlideNavigationVisibility(appearance)} onChange={(event) => change({ showNavigationButtons: event.target.checked })} />Show Previous, Next, and Restart buttons</label>
      <label className="block space-y-1 text-xs text-slate-600">Background<Select aria-label="Slide background style" value={background?.type ?? "master"} onChange={(event) => change(event.target.value === "master" ? { background: undefined, backgroundColor: undefined } : event.target.value === "solid" ? { background: { type: "solid" }, backgroundColor: appearance.backgroundColor ?? "#ffffff" } : { background: { type: "image", imageSrc: "", imagePosition: "center", overlayOpacity: 0 } })}><option value="master">Use master background</option><option value="solid">Solid color</option><option value="image">Image (fill slide)</option></Select></label>
      {background?.type === "solid" && <ColorPicker aria-label="Slide background color" value={appearance.backgroundColor ?? "#ffffff"} onChange={(backgroundColor) => change({ backgroundColor })} />}
      {background?.type === "image" && <>
        <Button variant="outline" size="sm" className="w-full" onClick={() => setImageOpen(true)}>{background.imageSrc ? "Replace slide background image" : "Choose or upload slide background image"}</Button>
        {background.imageSrc && <>
          <div aria-label="Slide background image preview" className="relative aspect-video overflow-hidden rounded-md border"><SlideMasterBackground master={resolveSlideAppearanceMaster(master, appearance)} /></div>
          <label className="block space-y-1 text-xs text-slate-600">Image position<Select aria-label="Slide background image position" value={background.imagePosition} onChange={(event) => change({ background: { ...background, imagePosition: event.target.value as "center" | "top" | "bottom" } })}><option value="center">Center</option><option value="top">Top</option><option value="bottom">Bottom</option></Select></label>
          <label className="block space-y-1 text-xs text-slate-600">Color overlay (%)<SlideNumberSettingInput aria-label="Slide background image overlay" min={0} max={90} value={background.overlayOpacity} onValueChange={(overlayOpacity) => change({ background: { ...background, overlayOpacity } })} /></label>
          <div className="space-y-1 text-xs text-slate-600">Overlay color<ColorPicker aria-label="Slide background overlay color" value={background.overlayColor ?? resolveSlideAppearanceMaster(master, appearance).backgroundColor} onChange={(overlayColor) => change({ background: { ...background, overlayColor } })} /></div>
          <Button variant="ghost" size="sm" onClick={() => change({ background: undefined, backgroundColor: undefined })}>Remove slide background image</Button>
        </>}
      </>}
      <Button variant="ghost" size="sm" onClick={() => onChange(undefined)}>Reset slide appearance</Button>
    </div>
    <MediaLibraryDialog courseId={courseId} kind="image" open={imageOpen} onClose={() => setImageOpen(false)} onSelect={(asset) => { change({ background: { type: "image", imageSrc: asset.fileUrl, imagePosition: background?.type === "image" ? background.imagePosition : "center", overlayOpacity: background?.type === "image" ? background.overlayOpacity : 0, overlayColor: background?.type === "image" ? background.overlayColor : undefined } }); setImageOpen(false); }} />
  </SlideInspectorSection>;
}
