"use client";

import { forwardRef, useLayoutEffect, useRef, useState, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { defaultSlideSize, type SlideSize } from "@/lib/editor/slide-design";

const STAGE_GUTTER = 24;

type SlideStageProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  size?: SlideSize;
  frameClassName?: string;
  canvasClassName?: string;
  fillViewport?: boolean;
  fillWidth?: boolean;
  zoom?: number;
  onScaleChange?: (scale: number) => void;
  canvasProps?: Omit<HTMLAttributes<HTMLDivElement>, "children" | "className"> & { [key: `data-${string}`]: string | number | boolean | undefined };
};

/** Fit the authored slide dimensions inside the workspace without changing its ratio. */
export const SlideStage = forwardRef<HTMLDivElement, SlideStageProps>(function SlideStage(
  { children, className, style, size = defaultSlideSize, frameClassName, canvasClassName, canvasProps, fillViewport = false, fillWidth = false, zoom, onScaleChange },
  canvasRef,
) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [fittedWidth, setFittedWidth] = useState<number | null>(null);
  const { width: canvasWidth, height: canvasHeight } = size;

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => {
      const gutter = fillViewport || fillWidth ? 0 : STAGE_GUTTER;
      const availableWidth = Math.max(0, stage.clientWidth - gutter * 2);
      const availableHeight = Math.max(0, stage.clientHeight - gutter * 2);
      if (zoom === undefined && (!availableWidth || !availableHeight)) return;
      const width = zoom === undefined
        ? Math.floor(Math.min(fillViewport || fillWidth ? Number.POSITIVE_INFINITY : canvasWidth, availableWidth, availableHeight * canvasWidth / canvasHeight))
        : Math.floor(canvasWidth * zoom / 100);
      setFittedWidth((previous) => previous === width ? previous : width);
      if (zoom === undefined) { stage.scrollLeft = 0; stage.scrollTop = 0; }
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(stage);
    window.addEventListener("resize", measure);
    return () => { observer?.disconnect(); window.removeEventListener("resize", measure); };
  }, [canvasWidth, canvasHeight, fillViewport, fillWidth, zoom]);

  useLayoutEffect(() => {
    if (fittedWidth !== null) onScaleChange?.(fittedWidth / canvasWidth);
  }, [fittedWidth, canvasWidth, onScaleChange]);

  return (
    <div ref={stageRef} data-slide-stage data-fill-viewport={fillViewport || undefined} data-fill-width={fillWidth || undefined} data-zoom={zoom ?? undefined} tabIndex={zoom !== undefined ? 0 : undefined} aria-label={zoom !== undefined ? "Scrollable slide canvas" : undefined} style={style} className={cn("flex min-h-0 min-w-0 items-center justify-center overflow-hidden p-6", (fillViewport || fillWidth) && "p-0", zoom !== undefined && "items-start justify-start overflow-auto", className)}>
      <div className={cn("relative shrink-0 overflow-hidden shadow-[0_24px_64px_-24px_rgba(0,0,0,0.55)]", fillViewport && "shadow-none", zoom !== undefined && "m-auto", frameClassName)} style={{ width: fittedWidth ?? canvasWidth, aspectRatio: `${canvasWidth} / ${canvasHeight}` }}>
        <div
          {...canvasProps}
          ref={canvasRef}
          data-slide-canvas=""
          style={{ ...canvasProps?.style, width: canvasWidth, height: canvasHeight, transform: `scale(${(fittedWidth ?? canvasWidth) / canvasWidth})`, transformOrigin: "top left" }}
          className={cn("absolute left-0 top-0 overflow-y-auto overscroll-contain rounded-sm bg-white text-slate-900", canvasClassName)}
        >
          {children}
        </div>
      </div>
    </div>
  );
});
