"use client";

import { useEffect, useRef, useState } from "react";
import type { SlideAction, SlideRecord } from "@/lib/slides/schema";
import type { SlideTheme } from "@/lib/slides/themes";
import { TemplateSurface, type TemplateAuthoring } from "./template-surface";
import { CanvasSurface, type CanvasAuthoring, type CanvasOverrides } from "./canvas-surface";
import { LearningPageSurface } from "./learning-page-surface";
import { masterSafeBounds, masterSettingsForSlide, renderSlideMaster } from "@/lib/slides/master-schema";
import { MasterSurface } from "./master-surface";

export function SlideSurface({ slide, theme, templateAuthoring, canvasAuthoring, overrides, onAction, staticPreview }: { slide: SlideRecord; theme: SlideTheme; templateAuthoring?: TemplateAuthoring; canvasAuthoring?: CanvasAuthoring; overrides?: CanvasOverrides; onAction?: (actions: SlideAction[]) => void; staticPreview?: boolean }) {
  if (slide.composition) return <LearningPageSurface slideTitle={slide.title} slideOrder={slide.order} page={{ ...slide.composition, ...masterSettingsForSlide(slide) }} theme={theme} onAction={onAction} staticPreview={staticPreview} />;
  const content = slide.template ? <TemplateSurface template={slide.template} theme={theme} authoring={templateAuthoring} onAction={onAction} staticPreview={staticPreview} /> : <CanvasSurface slide={slide} authoring={canvasAuthoring} overrides={overrides} onAction={onAction} staticPreview={staticPreview} />;
  const settings = masterSettingsForSlide(slide), master = renderSlideMaster(theme.master, settings.masterOverrides);
  if (!master?.enabled) return content;
  const safe = masterSafeBounds(master);
  return <div data-legacy-master-canvas style={{ width: 1280, height: 720, position: "relative", overflow: "hidden" }}><MasterSurface master={master} title={slide.title} order={slide.order} numbering={settings.numbering} /><div style={{ position: "absolute", left: safe.x, top: safe.y, width: safe.width, height: safe.height, overflow: "hidden" }}><div style={{ width: 1280, height: 720, transform: `scale(${safe.width / 1280}, ${safe.height / 720})`, transformOrigin: "top left" }}>{content}</div></div></div>;
}

export function SlideThumbnail({ slide, theme }: { slide: SlideRecord; theme: SlideTheme }) {
  const logicalWidth = slide.composition?.resolution === "fullHd" ? 1920 : 1280;
  const ref = useRef<HTMLDivElement>(null), [scale, setScale] = useState(.15);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => setScale(entries[0].contentRect.width / logicalWidth));
    observer.observe(element); setScale(element.clientWidth / logicalWidth);
    return () => observer.disconnect();
  }, [logicalWidth]);
  return <div ref={ref} aria-hidden="true" inert className="relative aspect-video w-full overflow-hidden rounded-lg bg-slate-100"><div className="pointer-events-none absolute top-0 left-0 origin-top-left" style={{ width: logicalWidth, transform: `scale(${scale})` }}><SlideSurface slide={slide} theme={theme} staticPreview /></div></div>;
}
