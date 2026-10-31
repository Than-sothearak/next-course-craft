"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SlideCover } from "@/lib/editor/slide-design";
import { SlideCoverEditor } from "./slide-cover-editor";
import { Image, Type } from "lucide-react";
import { SlideInspectorSection } from "./slide-inspector-section";

export function SlideCoverPanel({ cover, hasCover, courseId, courseTitle, onTitleChange, onChange, onOpenCover }: {
  cover?: SlideCover;
  hasCover: boolean;
  courseId: string;
  courseTitle: string;
  onTitleChange: (title: string) => void;
  onChange: (cover?: SlideCover) => void;
  onOpenCover: () => void;
}) {
  return cover ? <>
    <SlideInspectorSection title="Course title" icon={Type}><label className="block text-xs font-medium text-slate-600">Course title<Input value={courseTitle} maxLength={160} onChange={(event) => onTitleChange(event.target.value)} className="mt-1" /></label></SlideInspectorSection>
    <SlideCoverEditor cover={cover} courseId={courseId} onChange={onChange} onRemove={() => onChange(undefined)} />
  </> : <SlideInspectorSection title="Cover page" label="Cover page settings" icon={Image}>
    <p className="text-sm text-slate-500">{hasCover ? "Open the cover slide to edit its title, image, and Start button." : "Add an image cover at the start of your presentation."}</p>
    <Button type="button" variant="outline" size="sm" className="w-full" onClick={onOpenCover}>{hasCover ? "Edit cover page" : "Add cover page"}</Button>
  </SlideInspectorSection>;
}
