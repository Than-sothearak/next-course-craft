"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { ImagePlus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { CourseCover } from "@/components/course-cover";
import { courseCoverTemplates, normalizeCourseCover, type CourseCover as Cover } from "@/lib/editor/course-cover";
import type { CourseTheme } from "@/lib/editor/theme";
import { MediaLibraryDialog } from "../../media-library-dialog";

export function CourseCoverSettings({ courseId, courseTitle, theme, onChange }: { courseId: string; courseTitle: string; theme: CourseTheme; onChange: (theme: CourseTheme) => void }) {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const cover = normalizeCourseCover(theme.cover);
  const update = (change: Partial<Cover>) => onChange({ ...theme, cover: { ...cover, ...change } });
  return <fieldset className="mt-5 min-w-0 border-t border-slate-100 pt-4">
    <legend className="px-0 text-xs font-semibold text-slate-600">Course cover</legend>
    <p className="mb-3 text-xs leading-5 text-slate-500">Choose the opening design for your course.</p>
    <div className="grid grid-cols-2 gap-2">
      {courseCoverTemplates.map((preset) => <Button key={preset.id} type="button" variant="outline" aria-label={`Use ${preset.label} cover`} aria-pressed={cover.template === preset.id} title={preset.description}
        onClick={() => update({ template: preset.id, alignment: preset.id === "editorial" || preset.id === "geometric" ? "left" : "center", ...(preset.id !== "image" ? { imageSrc: "", imageAlt: "" } : {}) })}
        className={`relative block h-auto min-w-0 overflow-hidden p-0 text-left ${cover.template === preset.id ? "border-indigo-500 ring-1 ring-indigo-500" : "border-slate-200"}`}>
        <CourseCover cover={{ ...cover, template: preset.id }} primaryColor={theme.primaryColor} accentColor={theme.accentColor} className="h-20 px-3 py-4">
          {preset.id === "image" && !cover.imageSrc ? <ImagePlus size={22} className="mx-auto" /> : <><span className="block text-xs font-bold">Your course</span><span className="mt-2 block text-[9px] opacity-75">A new way to learn</span></>}
        </CourseCover>
        <span className="block px-2 py-2 text-[11px] font-medium text-slate-700">{preset.label}</span>
        {cover.template === preset.id && <Check aria-hidden="true" size={14} className="absolute bottom-2.5 right-2 text-indigo-600" />}
      </Button>)}
    </div>
    <div aria-label="Course cover preview" className="mt-3 overflow-hidden rounded-lg">
      <CourseCover cover={cover} primaryColor={theme.primaryColor} accentColor={theme.accentColor} className="px-5 py-8">
        <p className="text-lg font-bold leading-tight">{courseTitle || "Your course title"}</p>
        <span className="mt-4 inline-block rounded-full bg-white px-3 py-1.5 text-[10px] font-semibold text-slate-950">Start learning</span>
      </CourseCover>
    </div>
    {cover.template === "image" && <div className="mt-3 space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setLibraryOpen(true)}><ImagePlus size={14} />{cover.imageSrc ? "Change cover image" : "Choose cover image"}</Button>
        {cover.imageSrc && <Button type="button" variant="ghost" size="sm" onClick={() => update({ imageSrc: "", imageAlt: "" })}>Remove image</Button>}
      </div>
      <label className="block text-xs font-medium text-slate-600">Image description<Input aria-label="Cover image description" value={cover.imageAlt} maxLength={500} onChange={(event) => update({ imageAlt: event.target.value })} className="mt-1 h-9" /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs font-medium text-slate-600">Image position<Select aria-label="Cover image position" value={cover.imagePosition} onChange={(event) => update({ imagePosition: event.target.value as Cover["imagePosition"] })} className="mt-1 h-9"><option value="center">Center</option><option value="top">Top</option><option value="bottom">Bottom</option></Select></label>
        <label className="text-xs font-medium text-slate-600">Dark overlay (%)<Input aria-label="Cover image overlay" type="number" min={0} max={90} value={cover.overlayOpacity} onChange={(event) => { const value = event.target.valueAsNumber; if (Number.isInteger(value) && value >= 0 && value <= 90) update({ overlayOpacity: value }); }} className="mt-1 h-9" /></label>
      </div>
    </div>}
    <div className="mt-3 grid grid-cols-2 gap-3">
      <label className="text-xs font-medium text-slate-600">Cover color<Input type="color" aria-label="Cover background color" value={cover.backgroundColor ?? theme.primaryColor} onChange={(event) => update({ backgroundColor: event.target.value })} className="mt-1 h-9 p-1" /></label>
      <label className="text-xs font-medium text-slate-600">Text color<Input type="color" aria-label="Cover text color" value={cover.textColor} onChange={(event) => update({ textColor: event.target.value })} className="mt-1 h-9 p-1" /></label>
    </div>
    {cover.backgroundColor && <Button type="button" variant="ghost" size="sm" className="mt-1 h-8 px-0 text-xs" onClick={() => onChange({ ...theme, cover: { ...cover, backgroundColor: undefined } })}>Use brand color</Button>}
    <label className="mt-3 block text-xs font-medium text-slate-600">Title alignment<Select aria-label="Cover title alignment" value={cover.alignment} onChange={(event) => update({ alignment: event.target.value as Cover["alignment"] })} className="mt-1 h-9"><option value="center">Center</option><option value="left">Left</option></Select></label>
    {libraryOpen && createPortal(<MediaLibraryDialog courseId={courseId} kind="image" open onClose={() => setLibraryOpen(false)} onSelect={(asset) => { update({ template: "image", imageSrc: asset.fileUrl, imageAlt: asset.originalName }); setLibraryOpen(false); }} />, document.body)}
  </fieldset>;
}
