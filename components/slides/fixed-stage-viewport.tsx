"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { SlideViewportSize } from "./slide-viewport";

export const stageResolutions = {
  hd: { width: 1280, height: 720, label: "HD · 1280 × 720" },
  fullHd: { width: 1920, height: 1080, label: "Full HD · 1920 × 1080" },
} as const;
export type StageResolution = keyof typeof stageResolutions;

/** Fits a fixed logical frame into the available workspace without resizing it to its content. */
export function FixedStageViewport({ resolution = "hd", viewport = "desktop", children, background = "#ffffff", fitHeight = true }: { resolution?: StageResolution; viewport?: SlideViewportSize; children: ReactNode; background?: string; fitHeight?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState({ width: 768, height: 432 });
  const dimensions = stageResolutions[resolution];
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => { const bounds = element.getBoundingClientRect(); if (bounds.width > 0) setAvailable({ width: bounds.width, height: bounds.height || 432 }); };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure); observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const deviceWidth = viewport === "mobile" ? 390 : viewport === "tablet" ? 768 : Infinity;
  const scale = Math.max(.01, Math.min(1, available.width / dimensions.width, deviceWidth / dimensions.width, fitHeight ? available.height / dimensions.height : Infinity));
  return <div ref={ref} data-slide-viewport={viewport} data-fixed-stage-viewport className={`flex w-full min-w-0 items-center justify-center ${fitHeight ? "h-full min-h-[160px]" : ""}`} style={fitHeight ? undefined : { aspectRatio: "16 / 9" }}>
    <div data-stage-frame data-resolution={resolution} className="relative shrink-0 overflow-hidden rounded-lg border border-slate-300 shadow-lg" style={{ width: dimensions.width * scale, height: dimensions.height * scale, background }}>
      <div data-stage-content className="absolute top-0 left-0 origin-top-left overflow-auto overscroll-contain" style={{ width: dimensions.width, height: dimensions.height, transform: `scale(${scale})`, background }}>{children}</div>
    </div>
  </div>;
}
