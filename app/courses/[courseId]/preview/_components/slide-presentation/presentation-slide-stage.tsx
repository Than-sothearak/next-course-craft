"use client";

import type { ReactNode, Ref, UIEventHandler } from "react";
import { SlideStage } from "@/app/courses/[courseId]/_components/slide-presentation/slide-stage";
import { SlideSurface } from "@/app/courses/[courseId]/_components/slide-presentation/slide-surface";
import { SlideCoverRuntime } from "./slide-cover-runtime";
import { resolveSlideSize, slideNavigationLabel, type SlideCover, type SlideMaster } from "@/lib/editor/slide-design";
import { useSlidePresentationContext } from "./slide-presentation-context";
import { SlidePresentationControls } from "./slide-presentation-controls";
import { SlideCanvasMenu } from "./slide-canvas-menu";
import { SlideCanvasFullscreen } from "./slide-canvas-fullscreen";
import { SlidePlaybackContext } from "../../../_components/slide-presentation/slide-playback-context";

export function PresentationSlideStage({ active, visible, title, courseTitle, number, total, master, cover, quiz = false, quizFinished = true, canvasRef, onScroll, children, lessonId }: {
  active: boolean;
  visible: boolean;
  title: string;
  courseTitle?: string;
  number: number;
  total: number;
  master?: SlideMaster;
  cover?: SlideCover;
  quiz?: boolean;
  quizFinished?: boolean;
  canvasRef: Ref<HTMLDivElement>;
  onScroll: UIEventHandler<HTMLDivElement>;
  children: ReactNode;
  lessonId: string;
}) {
  const presentation = useSlidePresentationContext();
  const currentIndex = presentation?.slides.findIndex((slide) => slide.id === presentation.selectedId) ?? -1;
  const next = currentIndex >= 0 ? presentation?.slides[currentIndex + 1] : undefined;
  const nextLock = next && presentation ? presentation.getLockMessage(next.id) : null;
  if (!active) return <SlidePlaybackContext.Provider value={visible}>{children}</SlidePlaybackContext.Provider>;
  const menuControl = presentation && visible ? <>
    <SlideCanvasMenu menuOpen={presentation.menuOpen} onMenuOpenChange={presentation.onMenuOpenChange} menu={presentation.menu} />
    {presentation.zoom === undefined && <SlideCanvasFullscreen fullscreen={presentation.fullscreen} onToggle={presentation.onToggleFullscreen} />}
    {!cover && presentation.instructionAudioControl}
  </> : undefined;
  const controls = presentation && visible && (!quiz || quizFinished) ? <SlidePresentationControls slides={presentation.slides} selectedId={presentation.selectedId} onSelect={presentation.onSelect} onRestart={presentation.onRestart} getLockMessage={presentation.getLockMessage} /> : undefined;
  return (
    <SlidePlaybackContext.Provider value={visible}>
    <SlideStage
      size={resolveSlideSize(master)}
      ref={canvasRef}
      fillViewport={presentation?.zoom === undefined}
      zoom={presentation?.zoom}
      className="h-full w-full bg-white"
      frameClassName="shadow-none"
      canvasClassName={`rounded-none ${presentation?.fullscreen ? "border-0" : "border border-slate-200"}`}
      canvasProps={{ "aria-label": `Slide: ${slideNavigationLabel(title, number - 1)}`, "data-slide-active": visible, onScroll }}
    >
      {cover ? <SlideCoverRuntime lessonId={lessonId} visible={visible} cover={cover} title={courseTitle ?? title} master={master} number={number} total={total} controls={controls} menuControl={menuControl} onStart={next && presentation ? () => presentation.onSelect(next.id) : undefined} startDisabled={Boolean(nextLock)} startHint={nextLock ?? undefined}>{children}</SlideCoverRuntime> : <SlideSurface
        master={master}
        title={title}
        titleVisible={visible}
        number={number}
        total={total}
        controls={controls}
        menuControl={menuControl}
        contentRegion={quiz}
      >{children}</SlideSurface>}
    </SlideStage>
    </SlidePlaybackContext.Provider>
  );
}
