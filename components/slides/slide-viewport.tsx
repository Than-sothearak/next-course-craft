"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
export type SlideViewportSize = "desktop" | "tablet" | "mobile";
const widths: Record<SlideViewportSize, number> = { desktop: 1280, tablet: 768, mobile: 390 };

/** Uses a logical device width so a small workspace can still preview desktop layout. */
export function SlideViewport({ viewport, children, flow = false }: { viewport: SlideViewportSize; children: ReactNode; flow?: boolean }) {
  const availableRef = useRef<HTMLDivElement>(null), contentRef = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(768), [contentHeight, setContentHeight] = useState(720);
  const width = widths[viewport], scale = Math.min(1, availableWidth / width);
  useEffect(() => {
    const available = availableRef.current, content = contentRef.current;
    if (!available || !content || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === available) setAvailableWidth(entry.contentRect.width);
        else setContentHeight(entry.contentRect.height);
      }
    });
    observer.observe(available); observer.observe(content);
    setAvailableWidth(available.clientWidth);
    return () => observer.disconnect();
  }, [flow]);
  if (flow) return <div className="w-full" data-slide-viewport={viewport}><div className="mx-auto overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_12px_50px_-16px_#15204330]" style={{ maxWidth: width }}>{children}</div></div>;
  return <div ref={availableRef} className="w-full" data-slide-viewport={viewport}><div className="relative mx-auto overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_12px_50px_-16px_#15204330]" style={{ width: width * scale, height: contentHeight * scale }}><div ref={contentRef} className="absolute top-0 left-0 origin-top-left" style={{ width, transform: `scale(${scale})` }}>{children}</div></div></div>;
}
