"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SlideThumbnail, type SlideItem } from "@/app/courses/[courseId]/_components/slide-presentation/slide-navigation";
import type { SlideMaster } from "@/lib/editor/slide-design";

export function SlideEditorSidebar({ slides, activeId, onSelect, onAdd, master, courseTitle }: {
  slides: readonly SlideItem[];
  activeId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  master?: SlideMaster;
  courseTitle?: string;
}) {
  return (
    <aside aria-label="Slide thumbnails" className="sticky top-[84px] hidden max-h-[calc(100dvh-100px)] min-h-[340px] overflow-y-auto rounded-xl border border-slate-200 bg-slate-100 p-3 lg:block">
      <div className="mb-3 flex items-center justify-between px-1 text-xs font-semibold text-slate-600">
        <span>Slides</span><span>{slides.length}</span>
      </div>
      <div className="space-y-2">
        {slides.map((slide, index) => (
          <Button key={slide.id} type="button" variant="ghost" aria-label={`Edit slide ${index + 1}: ${slide.title}`} aria-current={slide.id === activeId ? "step" : undefined} onClick={() => onSelect(slide.id)} className="h-auto w-full flex-col items-stretch rounded-lg p-1 text-left ring-indigo-500 hover:bg-indigo-50 aria-[current=step]:bg-indigo-50 aria-[current=step]:ring-2">
            <SlideThumbnail slide={slide} index={index} master={master} courseTitle={courseTitle} />
          </Button>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onAdd} className="mt-3 w-full border-dashed"><Plus size={15} />Add slide</Button>
    </aside>
  );
}
