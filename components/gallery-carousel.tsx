"use client";

/* eslint-disable @next/next/no-img-element -- This shared gallery also runs in static exports. */
import { galleryImageFitClass } from "@/lib/editor/gallery";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { ContentBlock } from "@/lib/schemas/block";

type GalleryData = Extract<ContentBlock, { type: "gallery" }>["data"];

/** Native horizontal scrolling and snapping, shared by authoring and offline learners. */
export function GalleryCarousel({ data, presentation = false, decorative = false }: { data: GalleryData; presentation?: boolean; decorative?: boolean }) {
  const trackId = useId();
  const trackRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(0);
  const targetRef = useRef<number | null>(null);
  const [active, setActive] = useState(0);
  const [zoomedImage, setZoomedImage] = useState<GalleryData["images"][number] | null>(null);
  const [zoomTarget, setZoomTarget] = useState<Element | null>(null);
  const zoomTriggerRef = useRef<HTMLButtonElement | null>(null);
  const count = data.images.length;
  const index = Math.min(active, count - 1);

  const go = useCallback((requested: number, animate = true) => {
    const track = trackRef.current;
    const next = Math.max(0, Math.min(requested, count - 1));
    const item = track?.children[next] as HTMLElement | undefined;
    if (!track || !item) return;
    activeRef.current = next;
    targetRef.current = next;
    setActive(next);
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    track.scrollTo({ left: item.offsetLeft - (track.clientWidth - item.clientWidth) / 2, behavior: animate && !reduced ? "smooth" : "instant" });
  }, [count]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || decorative) return;
    const align = () => go(activeRef.current, false);
    const frame = requestAnimationFrame(align);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(align);
    observer?.observe(track);
    window.addEventListener("resize", align);
    return () => { cancelAnimationFrame(frame); observer?.disconnect(); window.removeEventListener("resize", align); };
  }, [go, decorative, presentation]);

  function syncScroll() {
    const track = trackRef.current;
    if (!track) return;
    const center = track.scrollLeft + track.clientWidth / 2;
    let nearest = 0;
    let distance = Infinity;
    Array.from(track.children).forEach((child, itemIndex) => {
      const item = child as HTMLElement;
      const nextDistance = Math.abs(item.offsetLeft + item.clientWidth / 2 - center);
      if (nextDistance < distance) { nearest = itemIndex; distance = nextDistance; }
    });
    if (targetRef.current !== null && nearest !== targetRef.current) return;
    targetRef.current = null;
    activeRef.current = nearest;
    setActive(nearest);
  }

  function closeZoom() {
    setZoomedImage(null);
    const trigger = zoomTriggerRef.current;
    requestAnimationFrame(() => { if (trigger?.isConnected) trigger.focus({ preventScroll: true }); });
  }

  return <section data-gallery-carousel role="region" aria-roledescription="carousel" aria-label="Image gallery" onPointerDown={(event) => event.stopPropagation()} onFocusCapture={(event) => { if (event.currentTarget.contains(event.target)) targetRef.current = null; }}
    onKeyDown={(event) => {
      if (decorative || zoomedImage || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      go(event.key === "Home" ? 0 : event.key === "End" ? count - 1 : activeRef.current + (event.key === "ArrowRight" ? 1 : -1));
    }} className={`min-w-0 ${presentation ? "flex h-full min-h-0 flex-col gap-3" : "space-y-3"}`}>
    <div ref={trackRef} id={trackId} data-gallery-track tabIndex={decorative ? -1 : 0} aria-label="Gallery images" onScroll={decorative ? undefined : syncScroll}
      onPointerDownCapture={() => { targetRef.current = null; }} onWheelCapture={() => { targetRef.current = null; }}
      className={`relative flex w-full snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain rounded-lg bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${presentation ? "min-h-0 flex-1" : "aspect-[16/10]"}`}>
      {data.images.map((image, imageIndex) => <div key={imageIndex} data-gallery-slide data-slide-animation-item role="group" aria-roledescription="slide" aria-label={`${imageIndex + 1} of ${count}`} className="h-full min-w-0 basis-full shrink-0 snap-center snap-always overflow-hidden rounded-lg">
        <Button type="button" variant="ghost" tabIndex={decorative ? -1 : 0} disabled={decorative} aria-label={`View gallery image ${imageIndex + 1}${image.alt ? `: ${image.alt}` : ""}`} aria-haspopup="dialog" aria-current={index === imageIndex ? "true" : undefined} onClick={(event) => {
          go(imageIndex);
          zoomTriggerRef.current = event.currentTarget;
          setZoomTarget(event.currentTarget.closest("dialog[open]") ?? document.fullscreenElement ?? document.body);
          setZoomedImage(image);
        }} className="group/gallery-image relative block h-full w-full cursor-zoom-in rounded-lg p-0 hover:bg-transparent disabled:opacity-100">
          <img src={image.src} alt={image.alt} draggable={false} className={`h-full w-full ${galleryImageFitClass(image.fit ?? data.imageFit ?? "cover")}`} />
          {!decorative && <span data-gallery-zoom-icon aria-hidden="true" className="pointer-events-none absolute right-3 top-3 grid size-8 place-items-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover/gallery-image:opacity-100 group-focus-visible/gallery-image:opacity-100 motion-reduce:transition-none"><ZoomIn size={18} /></span>}
        </Button>
      </div>)}
    </div>
    <div className="flex shrink-0 items-center justify-center gap-3">
      <Button type="button" variant="outline" size="icon" aria-label="Previous gallery image" aria-controls={trackId} disabled={decorative || index === 0} onClick={() => go(activeRef.current - 1)}><ChevronLeft size={18} /></Button>
      <span role="status" aria-live={decorative ? "off" : "polite"} aria-atomic="true" className="min-w-16 text-center text-sm tabular-nums">{index + 1} / {count}</span>
      <Button type="button" variant="outline" size="icon" aria-label="Next gallery image" aria-controls={trackId} disabled={decorative || index === count - 1} onClick={() => go(activeRef.current + 1)}><ChevronRight size={18} /></Button>
    </div>
    {zoomTarget && createPortal(<Dialog open={Boolean(zoomedImage)} onClose={closeZoom} title={`Image preview${zoomedImage?.alt ? `: ${zoomedImage.alt}` : ""}`} className="h-dvh max-h-none w-screen max-w-none rounded-none border-0 bg-black/95 text-white" contentClassName="flex h-full flex-col p-4 sm:p-6">
      <div className="min-h-0 flex-1" onKeyDown={(event) => event.stopPropagation()}>
        {zoomedImage && <img src={zoomedImage.src} alt={zoomedImage.alt} className="h-full w-full object-contain" />}
      </div>
    </Dialog>, zoomTarget)}
  </section>;
}
