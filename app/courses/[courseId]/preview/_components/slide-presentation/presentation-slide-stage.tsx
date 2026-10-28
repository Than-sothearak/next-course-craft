"use client";

import type { ReactNode, Ref, UIEventHandler } from "react";
import { SlideStage } from "@/app/courses/[courseId]/_components/slide-presentation/slide-stage";
import { SlideSurface } from "@/app/courses/[courseId]/_components/slide-presentation/slide-surface";
import { SlideCoverSurface } from "@/app/courses/[courseId]/_components/slide-presentation/slide-cover-surface";
import type { SlideCover, SlideMaster } from "@/lib/editor/slide-design";
import { useSlidePresentationContext } from "./slide-presentation-context";
import { SlidePresentationControls } from "./slide-presentation-controls";
import { SlideCanvasMenu } from "./slide-canvas-menu";
import { SlideCanvasFullscreen } from "./slide-canvas-fullscreen";

export function PresentationSlideStage({ active, visible, title, courseTitle, number, total, master, cover, canvasRef, onScroll, children }: {
  active: boolean;
  visible: boolean;
  title: string;
  courseTitle?: string;
  number: number;
  total: number;
  master?: SlideMaster;
  cover?: SlideCover;
  canvasRef: Ref<HTMLDivElement>;
  onScroll: UIEventHandler<HTMLDivElement>;
  children: ReactNode;
}) {
  const presentation = useSlidePresentationContext();
  const currentIndex = presentation?.slides.findIndex((slide) => slide.id === presentation.selectedId) ?? -1;
  const next = currentIndex >= 0 ? presentation?.slides[currentIndex + 1] : undefined;
  const nextLock = next && presentation ? presentation.getLockMessage(next.id) : null;
  const menuControl = presentation && visible ? <>
    <SlideCanvasMenu menuOpen={presentation.menuOpen} onMenuOpenChange={presentation.onMenuOpenChange} menu={presentation.menu} />
    <SlideCanvasFullscreen fullscreen={presentation.fullscreen} onToggle={presentation.onToggleFullscreen} />
  </> : undefined;
  if (!active) return <>{children}</>;
  return (
    <SlideStage
      ref={canvasRef}
      fillViewport={presentation?.fullscreen ?? false}
      className="h-full w-full bg-white"
      canvasClassName={presentation?.fullscreen ? "border-0" : "border border-slate-200"}
      canvasProps={{ "aria-label": `Slide: ${title}`, onScroll }}
    >
      {cover ? <SlideCoverSurface cover={cover} title={courseTitle ?? title} menuControl={menuControl} onStart={next && presentation ? () => presentation.onSelect(next.id) : undefined} startDisabled={Boolean(nextLock)} startHint={nextLock ?? undefined} /> : <SlideSurface
        master={master}
        title={title}
        number={number}
        total={total}
        controls={presentation && visible ? <SlidePresentationControls slides={presentation.slides} selectedId={presentation.selectedId} onSelect={presentation.onSelect} getLockMessage={presentation.getLockMessage} /> : undefined}
        menuControl={menuControl}
      >{children}</SlideSurface>}
    </SlideStage>
  );
}
