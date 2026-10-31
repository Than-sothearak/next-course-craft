"use client";

import { useState, type MouseEvent } from "react";
import { SlideNavigationControls } from "../../../_components/slide-presentation/slide-navigation-controls";
import type { SlideNavigationGuide } from "@/lib/editor/slide-design";

export function SlideEditorNavigation({ slides, selectedId, onSelect, guide }: { slides: readonly { id: string }[]; selectedId: string; onSelect: (id: string) => void; guide?: SlideNavigationGuide }) {
  const [guideStep, setGuideStep] = useState<number | null>(null);
  const index = slides.findIndex((slide) => slide.id === selectedId);
  const previous = slides[index - 1]; const next = slides[index + 1];
  function restart(event: MouseEvent<HTMLButtonElement>) {
    const canvas = event.currentTarget.closest<HTMLElement>("[data-slide-canvas]");
    canvas?.querySelectorAll<HTMLMediaElement>("[data-slide-media-player]").forEach((media) => {
      media.currentTime = 0;
      void media.play()?.catch(() => {});
    });
    canvas?.scrollTo?.({ top: 0, left: 0 });
  }
  return <SlideNavigationControls previousDisabled={!previous} nextDisabled={!next} onPrevious={() => previous && onSelect(previous.id)} onNext={() => next && onSelect(next.id)} onRestart={restart} guide={guide} guideStep={guideStep} onGuideStep={setGuideStep} />;
}
