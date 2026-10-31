"use client";

import { ArrowLeft, ArrowRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SlideMaster } from "@/lib/editor/slide-design";
import { SlideThumbnail, type SlideItem } from "./slide-thumbnail";
export { SlideThumbnail, type SlideItem } from "./slide-thumbnail";

export function SlideNavigation({ slides, activeId, onSelect, onAdd, getLockMessage, appearance = "editor", master, courseTitle }: {
  slides: readonly SlideItem[];
  activeId: string;
  onSelect: (id: string) => void;
  onAdd?: () => void;
  getLockMessage?: (id: string) => string | null;
  appearance?: "editor" | "presentation";
  master?: SlideMaster;
  courseTitle?: string;
}) {
  const index = slides.findIndex((slide) => slide.id === activeId);
  const previous = slides[index - 1];
  const next = slides[index + 1];
  const nextLock = next ? getLockMessage?.(next.id) : null;
  return (
    <nav aria-label="Slide navigation" className={cn("w-full shrink-0 border-t px-4 py-3", appearance === "presentation" ? "border-white/10 bg-slate-900 text-white" : "border-slate-200 bg-white")}>
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
        <Button type="button" variant="outline" size="sm" disabled={!previous} onClick={() => previous && onSelect(previous.id)} className={appearance === "presentation" ? "border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white" : undefined}><ArrowLeft size={15} /> Previous</Button>
        <span className={cn("text-xs font-semibold", appearance === "presentation" ? "text-slate-300" : "text-slate-600")}>Slide {index + 1} of {slides.length}</span>
        <Button type="button" variant="outline" size="sm" disabled={!next || Boolean(nextLock)} title={nextLock ?? undefined} onClick={() => next && onSelect(next.id)} className={appearance === "presentation" ? "border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white" : undefined}>Next <ArrowRight size={15} /></Button>
      </div>
      <div className="mx-auto mt-3 flex max-w-5xl gap-2 overflow-x-auto pb-1" aria-label="Slide thumbnails">
        {slides.map((slide, slideIndex) => {
          const lock = getLockMessage?.(slide.id);
          return <div key={slide.id} className="relative w-36 shrink-0">
            <SlideThumbnail slide={slide} index={slideIndex} total={slides.length} master={master} courseTitle={courseTitle} />
            <Button type="button" variant="ghost" aria-label={`Go to slide ${slideIndex + 1}: ${slide.title}`} aria-current={slide.id === activeId ? "step" : undefined} disabled={Boolean(lock)} title={lock ?? slide.title} onClick={() => onSelect(slide.id)} className={cn("absolute inset-0 z-10 h-full w-full rounded-lg border-2 border-transparent bg-transparent p-0 ring-indigo-500 focus-visible:ring-2 aria-[current=step]:border-indigo-500", appearance === "presentation" ? "hover:bg-white/10" : "hover:bg-indigo-50/20")} />
          </div>;
        })}
        {onAdd && <Button type="button" variant="outline" onClick={onAdd} className="h-auto w-36 shrink-0 flex-col gap-1 rounded-lg border-dashed"><Plus size={18} />Add slide</Button>}
      </div>
    </nav>
  );
}
