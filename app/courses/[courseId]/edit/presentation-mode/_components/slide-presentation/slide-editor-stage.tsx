"use client";

import type { ReactNode } from "react";
import { SlideEditorCanvas } from "./slide-editor-canvas";
import { SlideEditorInspector } from "./slide-editor-inspector";
import type { SlideSize } from "@/lib/editor/slide-design";
import { SlideSurface } from "@/app/courses/[courseId]/_components/slide-presentation/slide-surface";
import type { SlideMaster } from "@/lib/editor/slide-design";

export function SlideEditorStage({ active, title, zoom, onZoomChange, size, inspector, children, controls, master, contentRegion = false, number = 1, total = 1 }: { active: boolean; title: string; zoom?: number; size?: SlideSize; onZoomChange: (zoom: number | undefined) => void; inspector?: ReactNode; children: ReactNode; controls?: ReactNode; master?: SlideMaster; contentRegion?: boolean; number?: number; total?: number }) {
  if (!active) return <>{children}</>;
  return (
    <div aria-label="Presentation slide editor" className={inspector ? "grid h-full min-h-0 min-w-0 grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-3 overflow-hidden xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_420px] xl:grid-rows-1" : undefined}>
      <SlideEditorCanvas fillAvailable={Boolean(inspector)} label={title} zoom={zoom} size={size} onZoomChange={onZoomChange}>{controls ? <SlideSurface title={title} master={master} number={number} total={total} controls={controls} contentRegion={contentRegion}>{children}</SlideSurface> : children}</SlideEditorCanvas>
      {inspector && <SlideEditorInspector>{inspector}</SlideEditorInspector>}
    </div>
  );
}
