"use client";

import type { ReactNode } from "react";
import { SlideEditorCanvas } from "./slide-editor-canvas";
import type { SlideSize } from "@/lib/editor/slide-design";
import { SlideSurface } from "../../../_components/slide-presentation/slide-surface";
import type { SlideMaster } from "@/lib/editor/slide-design";

export function SlideEditorStage({ active, title, zoom, onZoomChange, size, inspector, children, controls, master, contentRegion = false, number = 1, total = 1 }: { active: boolean; title: string; zoom?: number; size?: SlideSize; onZoomChange: (zoom: number | undefined) => void; inspector?: ReactNode; children: ReactNode; controls?: ReactNode; master?: SlideMaster; contentRegion?: boolean; number?: number; total?: number }) {
  if (!active) return <>{children}</>;
  return (
    <div aria-label="Presentation slide editor" className={inspector ? "grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_420px]" : undefined}>
      <SlideEditorCanvas label={title} zoom={zoom} size={size} onZoomChange={onZoomChange}>{controls ? <SlideSurface title={title} master={master} number={number} total={total} controls={controls} contentRegion={contentRegion}>{children}</SlideSurface> : children}</SlideEditorCanvas>
      {inspector && <aside aria-label="Slide inspector" className="max-h-[760px] min-w-0 space-y-3 overflow-y-auto">{inspector}</aside>}
    </div>
  );
}
