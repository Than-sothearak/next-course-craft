"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { defaultSlideCoverTypography, type SlideCover } from "@/lib/editor/slide-design";
import { MediaLibraryDialog } from "../media-library-dialog";
import { MessageCircle, FileText, ImagePlus, Move, Trash2, Type } from "lucide-react";
import { SlideInspectorSection } from "./slide-inspector-section";
import { SlideCoverLayoutControls } from "./slide-cover-layout-controls";
import { SlideCoverInstructionControls } from "./slide-cover-instruction-controls";
import { SlideTypographyControls } from "./slide-typography-controls";
import { SlideNumberSettingInput } from "./slide-number-setting-input";

export function SlideCoverEditor({ cover, courseId, onChange, onRemove }: {
  cover: SlideCover;
  courseId: string;
  onChange: (cover: SlideCover) => void;
  onRemove: () => void;
}) {
  const [imageOpen, setImageOpen] = useState(false);
  return <section className="space-y-2" aria-label="Cover slide content settings">
    <SlideInspectorSection title="Cover content" icon={FileText}>
    <p className="text-xs text-slate-500">The course title appears on this slide. Edit it in the course title field.</p>
    <label className="block text-xs font-medium text-slate-600">Subtitle<Textarea value={cover.subtitle} maxLength={300} onChange={(event) => onChange({ ...cover, subtitle: event.target.value })} className="mt-1 min-h-16" /></label>
    <div className="grid grid-cols-2 gap-3"><label className="block text-xs font-medium text-slate-600">Lesson label<Input value={cover.lessonOf} maxLength={160} onChange={(event) => onChange({ ...cover, lessonOf: event.target.value })} className="mt-1" /></label>
    <label className="block text-xs font-medium text-slate-600">Start button label<Input value={cover.startLabel} maxLength={60} onChange={(event) => onChange({ ...cover, startLabel: event.target.value })} className="mt-1" /></label>
    </div>
    </SlideInspectorSection>
    <SlideInspectorSection title="Cover typography" icon={Type}>
      {(["title", "subtitle", "label", "button"] as const).map((part) => <div key={part} className="space-y-2 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
        <h4 className="text-xs font-semibold capitalize text-slate-700">{part === "label" ? "Lesson label" : part === "button" ? "Start button" : part}</h4>
        <SlideTypographyControls label={`Cover ${part}`} value={cover[`${part}Style`] ?? defaultSlideCoverTypography[part]} onChange={(style) => onChange({ ...cover, [`${part}Style`]: style })} />
      </div>)}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1 text-xs text-slate-600">Button background<ColorPicker aria-label="Cover button background" value={cover.buttonBackgroundColor ?? "#ffffff"} onChange={(color) => onChange({ ...cover, buttonBackgroundColor: color })} /></div>
        <label className="text-xs text-slate-600">Button corners (px)<SlideNumberSettingInput aria-label="Cover button corners" min={0} max={48} value={cover.buttonRadius ?? 8} className="mt-1" onValueChange={(buttonRadius) => onChange({ ...cover, buttonRadius })} /></label>
      </div>
    </SlideInspectorSection>
    <SlideInspectorSection title="Cover image" icon={ImagePlus}>
    <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setImageOpen(true)}><ImagePlus size={14} aria-hidden="true" />{cover.imageSrc ? "Replace cover image" : "Choose or upload cover image"}</Button>
    {cover.imageSrc && <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ ...cover, imageSrc: "" })}>Remove image</Button>}
    <label className="block text-xs font-medium text-slate-600">Image description<Input value={cover.imageAlt} maxLength={500} onChange={(event) => onChange({ ...cover, imageAlt: event.target.value })} className="mt-1" /></label>
    <label className="block text-xs font-medium text-slate-600">Dark overlay: {cover.overlayOpacity}%<Input type="range" min={0} max={90} value={cover.overlayOpacity} onChange={(event) => onChange({ ...cover, overlayOpacity: Number(event.target.value) })} className="mt-1" /></label>
    </SlideInspectorSection>
    <SlideInspectorSection title="Cover layout" icon={Move}><SlideCoverLayoutControls cover={cover} onChange={onChange} /></SlideInspectorSection>
    <SlideInspectorSection title="Welcome notice" icon={MessageCircle}><SlideCoverInstructionControls cover={cover} onChange={onChange} /></SlideInspectorSection>
    <Button type="button" variant="outline" size="sm" className="w-full text-rose-600" onClick={onRemove}><Trash2 size={14} aria-hidden="true" />Remove cover preset</Button>
    <MediaLibraryDialog courseId={courseId} kind="image" open={imageOpen} onClose={() => setImageOpen(false)} onSelect={(asset) => { onChange({ ...cover, imageSrc: asset.fileUrl, imageAlt: cover.imageAlt || asset.originalName }); setImageOpen(false); }} />
  </section>;
}
