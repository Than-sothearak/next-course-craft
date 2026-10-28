"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SlideItem } from "@/app/courses/[courseId]/_components/slide-presentation/slide-navigation";

export function SlidePresentationControls({ slides, selectedId, onSelect, getLockMessage }: {
  slides: readonly SlideItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  getLockMessage: (id: string) => string | null;
}) {
  const index = slides.findIndex((slide) => slide.id === selectedId);
  const previous = index > 0 ? slides[index - 1] : undefined;
  const next = index >= 0 ? slides[index + 1] : undefined;
  const previousLock = previous ? getLockMessage(previous.id) : null;
  const nextLock = next ? getLockMessage(next.id) : null;
  return (
    <nav aria-label="Slide navigation" className="absolute inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-5 py-1 text-slate-800">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
        <Button type="button" variant="outline" size="sm" disabled={!previous || Boolean(previousLock)} title={previousLock ?? undefined} onClick={() => previous && onSelect(previous.id)}><ArrowLeft size={15} />Previous</Button>
        <span className="text-xs font-semibold text-slate-600">Slide {index >= 0 ? index + 1 : 0} of {slides.length}</span>
        <Button type="button" variant="outline" size="sm" disabled={!next || Boolean(nextLock)} title={nextLock ?? undefined} onClick={() => next && onSelect(next.id)}>Next<ArrowRight size={15} /></Button>
      </div>
    </nav>
  );
}
