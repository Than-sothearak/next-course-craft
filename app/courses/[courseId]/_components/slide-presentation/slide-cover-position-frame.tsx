"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { SlideCoverElementLayout } from "@/lib/editor/slide-design";
import { coverElementStyle, fitCoverContent } from "@/lib/editor/slide-cover-layout";

export function SlideCoverPositionFrame({ layout, element, children }: { layout: SlideCoverElementLayout; element?: string; children: ReactNode }) {
  const { position, offsetX, offsetY } = layout;
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<ReturnType<typeof fitCoverContent> | null>(null);
  useLayoutEffect(() => {
    const viewport = viewportRef.current; const content = contentRef.current;
    if (!viewport || !content) return;
    let frame: number | null = null;
    const measure = () => {
      frame = null;
      if (!viewport.clientWidth || !viewport.clientHeight || !content.clientHeight) return;
      const next = fitCoverContent({ width: viewport.clientWidth, height: viewport.clientHeight }, { width: Math.max(content.clientWidth, content.scrollWidth), height: Math.max(content.clientHeight, content.scrollHeight) }, { position, offsetX, offsetY });
      setFit((current) => current?.scale === next.scale && current.left === next.left && current.top === next.top ? current : next);
    };
    const schedule = () => { if (frame === null) frame = requestAnimationFrame(measure); };
    measure();
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    resize?.observe(viewport); resize?.observe(content);
    const mutation = new MutationObserver(schedule); mutation.observe(content, { subtree: true, childList: true, characterData: true });
    document.fonts?.addEventListener("loadingdone", schedule); window.addEventListener("resize", schedule);
    return () => { if (frame !== null) cancelAnimationFrame(frame); resize?.disconnect(); mutation.disconnect(); document.fonts?.removeEventListener("loadingdone", schedule); window.removeEventListener("resize", schedule); };
  }, [position, offsetX, offsetY]);
  return <div ref={viewportRef} data-cover-position={element} data-cover-content-position={element ? undefined : layout.position} className="pointer-events-none absolute inset-x-16 top-10 z-10" style={{ bottom: "calc(var(--slide-footer-height, 64px) + 32px)" }}>
    <div ref={contentRef} data-cover-position-content data-cover-content-scale={fit?.scale ?? 1} className="pointer-events-auto absolute flow-root w-full" style={fit ? { left: fit.left, top: fit.top, transform: `scale(${fit.scale})`, transformOrigin: "top left", textAlign: layout.position.split("-")[1] as "left" | "center" | "right" } : coverElementStyle(layout)}>{children}</div>
  </div>;
}
