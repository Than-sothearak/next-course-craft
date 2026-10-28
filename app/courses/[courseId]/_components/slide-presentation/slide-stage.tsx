"use client";

import { forwardRef, useLayoutEffect, useRef, useState, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const SLIDE_WIDTH = 960;
const SLIDE_HEIGHT = 540;
const STAGE_GUTTER = 24;

type SlideStageProps = {
  children: ReactNode;
  className?: string;
  canvasClassName?: string;
  fillViewport?: boolean;
  fillWidth?: boolean;
  zoom?: number;
  canvasProps?: Omit<HTMLAttributes<HTMLDivElement>, "children" | "className">;
};

/** Fit a fixed 16:9 slide inside its workspace without changing the canvas ratio. */
export const SlideStage = forwardRef<HTMLDivElement, SlideStageProps>(function SlideStage(
  { children, className, canvasClassName, canvasProps, fillViewport = false, fillWidth = false, zoom },
  canvasRef,
) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [fittedWidth, setFittedWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => {
      const gutter = fillViewport || fillWidth ? 0 : STAGE_GUTTER;
      const availableWidth = Math.max(0, stage.clientWidth - gutter * 2);
      const availableHeight = Math.max(0, stage.clientHeight - gutter * 2);
      if (!availableWidth || !availableHeight) return;
      const width = zoom === undefined
        ? Math.floor(Math.min(fillViewport || fillWidth ? Number.POSITIVE_INFINITY : SLIDE_WIDTH, availableWidth, availableHeight * SLIDE_WIDTH / SLIDE_HEIGHT))
        : Math.floor(SLIDE_WIDTH * zoom / 100);
      setFittedWidth((previous) => previous === width ? previous : width);
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(stage);
    window.addEventListener("resize", measure);
    return () => { observer?.disconnect(); window.removeEventListener("resize", measure); };
  }, [fillViewport, fillWidth, zoom]);

  return (
    <div ref={stageRef} data-slide-stage data-fill-viewport={fillViewport || undefined} data-fill-width={fillWidth || undefined} data-zoom={zoom ?? undefined} className={cn("flex min-h-0 min-w-0 items-center justify-center overflow-hidden p-6", (fillViewport || fillWidth) && "p-0", zoom !== undefined && "overflow-auto", className)}>
      <div className={cn("relative shrink-0 shadow-[0_24px_64px_-24px_rgba(0,0,0,0.55)]", fillViewport && "shadow-none", zoom !== undefined && "m-auto")} style={{ width: fittedWidth ?? SLIDE_WIDTH, aspectRatio: `${SLIDE_WIDTH} / ${SLIDE_HEIGHT}` }}>
        <div
          {...canvasProps}
          ref={canvasRef}
          data-slide-canvas=""
          style={{ ...canvasProps?.style, width: SLIDE_WIDTH, height: SLIDE_HEIGHT, transform: `scale(${(fittedWidth ?? SLIDE_WIDTH) / SLIDE_WIDTH})`, transformOrigin: "top left" }}
          className={cn("absolute left-0 top-0 overflow-y-auto overscroll-contain rounded-sm bg-white text-slate-900", canvasClassName)}
        >
          {children}
        </div>
      </div>
    </div>
  );
});
