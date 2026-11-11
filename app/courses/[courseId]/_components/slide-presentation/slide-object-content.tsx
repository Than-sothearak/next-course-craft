"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { fitSlideContent } from "@/lib/editor/slide-content-fit";

/** Keep every rendered block inside its frame, including content added or expanded later. */
export function SlideObjectContent({ children, media = false, scroll = false }: { children: ReactNode; media?: boolean; scroll?: boolean }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ scale: 1, left: 0, top: 0 });

  useLayoutEffect(() => {
    if (media || scroll) return;
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;
    let frame: number | null = null;
    let disposed = false;
    function measure() {
      frame = null;
      if (disposed || !viewport || !content || !viewport.clientWidth || !viewport.clientHeight) return;
      const next = fitSlideContent(
        { width: viewport.clientWidth, height: viewport.clientHeight },
        { width: Math.max(content.clientWidth, content.scrollWidth), height: Math.max(content.clientHeight, content.scrollHeight) },
      );
      setFit((previous) => previous.scale === next.scale && previous.left === next.left && previous.top === next.top ? previous : next);
    }
    function schedule() {
      if (!disposed && frame === null) frame = requestAnimationFrame(measure);
    }
    measure();
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    resize?.observe(viewport);
    resize?.observe(content);
    const mutation = new MutationObserver(schedule);
    mutation.observe(content, { subtree: true, childList: true, characterData: true, attributes: true });
    content.addEventListener("load", schedule, true);
    content.addEventListener("error", schedule, true);
    content.addEventListener("loadedmetadata", schedule, true);
    document.fonts?.addEventListener("loadingdone", schedule);
    window.addEventListener("resize", schedule);
    return () => {
      disposed = true;
      if (frame !== null) cancelAnimationFrame(frame);
      resize?.disconnect();
      mutation.disconnect();
      content.removeEventListener("load", schedule, true);
      content.removeEventListener("error", schedule, true);
      content.removeEventListener("loadedmetadata", schedule, true);
      document.fonts?.removeEventListener("loadingdone", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [media, scroll]);

  const unscaled = media || scroll;

  return (
    <div ref={viewportRef} data-slide-object-content data-content-scale={unscaled ? 1 : fit.scale} className={`relative h-full w-full min-w-0 ${scroll ? "overflow-x-hidden overflow-y-auto overscroll-contain" : ""}`} style={{ backgroundColor: "transparent" }}>
      <div ref={contentRef} data-slide-content-body className={scroll ? "relative flow-root min-h-full w-full min-w-0" : "absolute flow-root h-full w-full min-w-0"} style={{
        left: unscaled ? 0 : fit.left,
        top: unscaled ? 0 : fit.top,
        transform: !unscaled && fit.scale < 1 ? `scale(${fit.scale})` : undefined,
        transformOrigin: "top left",
      }}>
        {children}
      </div>
    </div>
  );
}
