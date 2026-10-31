"use client";

import type { SlideItem } from "@/app/courses/[courseId]/_components/slide-presentation/slide-navigation";
import { SlideNavigationControls } from "../../../_components/slide-presentation/slide-navigation-controls";
import { useSlidePresentationContext } from "./slide-presentation-context";

export function SlidePresentationControls({ slides, selectedId, onSelect, onRestart, getLockMessage }: {
  slides: readonly SlideItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRestart: () => void;
  getLockMessage: (id: string) => string | null;
}) {
  const index = slides.findIndex((slide) => slide.id === selectedId);
  const previous = index > 0 ? slides[index - 1] : undefined;
  const next = index >= 0 ? slides[index + 1] : undefined;
  const previousLock = previous ? getLockMessage(previous.id) : null;
  const nextLock = next ? getLockMessage(next.id) : null;
  const presentation = useSlidePresentationContext();
  return <SlideNavigationControls previousDisabled={!previous || Boolean(previousLock)} nextDisabled={!next || Boolean(nextLock)} previousHint={previousLock ?? undefined} nextHint={nextLock ?? undefined} onPrevious={() => previous && onSelect(previous.id)} onNext={() => next && onSelect(next.id)} onRestart={onRestart} guide={presentation?.navigationGuide} guideStep={presentation?.menuOpen ? null : presentation?.guideStep} onGuideStep={presentation?.onGuideStep} />;
}
