"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { slideAbstractDesigns, type SlideMaster } from "@/lib/editor/slide-design";
import { SlideMasterBackground } from "../../../_components/slide-presentation/slide-master-background";
import { MediaLibraryDialog } from "../media-library-dialog";

export function SlideMasterBackgroundControls({ master, courseId, onChange }: {
  master: SlideMaster;
  courseId: string;
  onChange: (master: SlideMaster) => void;
}) {
  const [imageOpen, setImageOpen] = useState(false);
  const background = master.background;
  return <div className="space-y-3">
    <label className="block text-xs font-medium text-slate-600">Background style
      <Select aria-label="Master background style" value={background?.type ?? "theme"} className="mt-1" onChange={(event) => {
        const type = event.target.value;
        onChange({ ...master, background: type === "theme" ? undefined : type === "solid" ? { type } : type === "abstract" ? { type, design: "waves" } : { type: "image", imageSrc: "", imagePosition: "center", overlayOpacity: 30 } });
      }}>
        <option value="theme">Theme background</option><option value="solid">Solid color</option><option value="abstract">Free abstract design</option><option value="image">Image</option>
      </Select>
    </label>
    {background?.type === "abstract" && <div className="grid grid-cols-2 gap-2" aria-label="Free abstract backgrounds">
      {slideAbstractDesigns.map((design) => <Button key={design.id} type="button" variant="outline" aria-pressed={background.design === design.id} onClick={() => onChange({ ...master, background: { type: "abstract", design: design.id } })} className="h-auto flex-col items-stretch gap-1 p-2 text-left text-xs aria-pressed:ring-2 aria-pressed:ring-indigo-500">
        <span className="relative block aspect-video overflow-hidden rounded-sm"><SlideMasterBackground master={{ ...master, background: { type: "abstract", design: design.id } }} /></span>
        {design.name}
      </Button>)}
    </div>}
    {background?.type === "image" && <>
      <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setImageOpen(true)}>{background.imageSrc ? "Replace background image" : "Choose or upload background image"}</Button>
      {background.imageSrc && <>
        <div aria-label="Master background image preview" className="relative aspect-video overflow-hidden rounded-md border"><SlideMasterBackground master={master} /></div>
        <label className="block text-xs font-medium text-slate-600">Image position<Select aria-label="Master background image position" value={background.imagePosition} className="mt-1" onChange={(event) => onChange({ ...master, background: { ...background, imagePosition: event.target.value as "center" | "top" | "bottom" } })}><option value="center">Center</option><option value="top">Top</option><option value="bottom">Bottom</option></Select></label>
        <label className="block text-xs font-medium text-slate-600">Color overlay: {background.overlayOpacity}%<Input aria-label="Master background image overlay" type="range" min={0} max={90} value={background.overlayOpacity} className="mt-1" onChange={(event) => onChange({ ...master, background: { ...background, overlayOpacity: Number(event.target.value) } })} /></label>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ ...master, background: { type: "solid" } })}>Remove background image</Button>
      </>}
    </>}
    <MediaLibraryDialog courseId={courseId} kind="image" open={imageOpen} onClose={() => setImageOpen(false)} onSelect={(asset) => {
      onChange({ ...master, background: { type: "image", imageSrc: asset.fileUrl, imagePosition: background?.type === "image" ? background.imagePosition : "center", overlayOpacity: background?.type === "image" ? background.overlayOpacity : 30 } });
      setImageOpen(false);
    }} />
  </div>;
}
