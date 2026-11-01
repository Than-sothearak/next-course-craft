"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { ContentBlock } from "@/lib/schemas/block";
import type { QuizQuestion } from "@/lib/schemas/quiz";
import { resolveCanvasSlideFrame, resolveSlideSize, slideNavigationLabel, type SlideCover, type SlideMaster, type SlideHeaderStyle } from "@/lib/editor/slide-design";
import { isSlideMediaObject, resolveSlideMedia } from "@/lib/editor/slide-objects";
import { PreviewBlock } from "../../preview/_components/(course_preview_components)/(lesson_reader_preview_components)/(lesson_blocks_preview_components)/preview-block";
import { QuizAssessmentPreview } from "../../preview/_components/(course_preview_components)/(lesson_reader_preview_components)/quiz-assessment-preview";
import { slideObjectSurfaceStyle } from "../../preview/_components/(course_preview_components)/preview-utils";
import { SlideSurface } from "./slide-surface";
import { SlideCoverSurface } from "./slide-cover-surface";
import { SlideObjectContent } from "./slide-object-content";
import { SlideMediaPlayer } from "./slide-media-player";
import { croppedMediaStyle, cropViewportStyle, isSlideVideoFile, resolveSlideCrop } from "@/lib/editor/slide-crop";
import type { SlideAppearance } from "@/lib/editor/slide-design";

export type SlideItem = { id: string; title: string; blocks: readonly ContentBlock[]; slideCover?: SlideCover; slideHeaderStyle?: SlideHeaderStyle; slideAppearance?: SlideAppearance; lessonType?: "content" | "quiz"; quizQuestions?: readonly QuizQuestion[]; passingScore?: number };

function ThumbnailBlock({ block }: { block: ContentBlock }) {
  if (block.type === "video" && isSlideVideoFile(block)) {
    const crop = resolveSlideCrop(block);
    const dimensions = resolveSlideMedia(block);
    return <div className="flex h-full w-full items-center justify-center" style={crop ? { containerType: "size" } : undefined}><div className="relative h-full w-full overflow-hidden" style={crop && dimensions ? cropViewportStyle(dimensions, crop) : undefined} data-slide-media-crop={crop ? true : undefined}><video src={block.data.src || undefined} muted playsInline preload="metadata" tabIndex={-1} style={crop ? croppedMediaStyle(crop) : undefined} className="h-full w-full object-contain" /></div></div>;
  }
  if (block.type === "audio") return <SlideMediaPlayer block={block} decorative />;
  return <PreviewBlock block={block} slideLayout authoring decorative device="desktop" orientation="landscape" />;
}

/** Scale the authored slide into a non-interactive thumbnail. */
export function SlideThumbnail({ slide, index, total = 1, master, courseTitle }: { slide: SlideItem; index: number; total?: number; master?: SlideMaster; courseTitle?: string }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1 / 6);
  const size = resolveSlideSize(master);
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const measure = () => { if (viewport.clientWidth) setScale(viewport.clientWidth / size.width); };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(viewport);
    window.addEventListener("resize", measure);
    return () => { observer?.disconnect(); window.removeEventListener("resize", measure); };
  }, [size.width]);
  const blockObjects = (<div className="relative h-full w-full">
              {slide.blocks.map((block, blockIndex) => {
                const frame = resolveCanvasSlideFrame(block, blockIndex, slide.blocks.length, master, Boolean(slide.slideCover));
                return <div key={block.id} data-slide-object-frame data-slide-thumbnail-object-id={block.id} className="absolute overflow-hidden rounded-md" style={{ left: `${frame.x}%`, top: `${frame.y}%`, width: `${frame.width}%`, height: `${frame.height}%`, zIndex: frame.z + 1, ...slideObjectSurfaceStyle(block, master?.backgroundColor, master?.textColor) }}>
                  <SlideObjectContent media={isSlideMediaObject(block)}><ThumbnailBlock block={{ ...block, id: `thumbnail-${slide.id}-${block.id}` }} /></SlideObjectContent>
                </div>;
              })}
            </div>);
  return <div data-slide-thumbnail={slide.id} aria-hidden="true" className="min-w-0 select-none">
    <div className="overflow-hidden border border-slate-200 bg-white">
      <div ref={viewportRef} data-slide-thumbnail-viewport className="relative overflow-hidden" style={{ aspectRatio: `${size.width} / ${size.height}` }}>
        <div inert data-slide-thumbnail-canvas className="pointer-events-none absolute left-0 top-0 overflow-hidden text-left" style={{ width: size.width, height: size.height, transform: `scale(${scale})`, transformOrigin: "top left" }}>
          {slide.slideCover ? <SlideCoverSurface appearance={slide.slideAppearance} cover={slide.slideCover} title={courseTitle ?? slide.title} master={master} number={index + 1} total={total} onStart={() => {}} startDisabled={index >= total - 1} decorative>{blockObjects}</SlideCoverSurface> : <SlideSurface appearance={slide.slideAppearance} master={master} headerTextStyle={slide.slideHeaderStyle} title={slide.title} number={index + 1} total={total} decorative contentRegion={slide.lessonType === "quiz"}>
            {slide.lessonType === "quiz" ? slide.quizQuestions?.length ? <QuizAssessmentPreview presentation questions={slide.quizQuestions.map((question) => ({ ...question, id: `thumbnail-${slide.id}-${question.id}` }))} passingScore={slide.passingScore ?? 70} wasPassed={false} onResult={() => {}} /> : <div className="mt-10 rounded-xl border border-dashed border-slate-300 px-5 py-8 text-center text-sm text-slate-500">This quiz has no questions yet.</div> : blockObjects}
          </SlideSurface>}
        </div>
      </div>
    </div>
    <p data-slide-thumbnail-label className="truncate px-1 pb-1 pt-2 pr-8 text-xs font-medium text-slate-600">{index + 1}. {slideNavigationLabel(slide.title, index)}</p>
  </div>;
}
