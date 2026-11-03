"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { ContentBlock } from "@/lib/schemas/block";
import { SlideMediaPicker, slideMediaKind } from "./slide-media-picker";

export function SlideCanvasMediaReplace({ block, courseId, onChange }: {
  block: ContentBlock | null | undefined;
  courseId: string;
  onChange: (block: ContentBlock) => void;
}) {
  if (!block || block.slideLocked || block.slideHiddenInEditor || !slideMediaKind(block)) return null;
  return <CanvasMediaReplace key={block.id} block={block} courseId={courseId} onChange={onChange} />;
}

function CanvasMediaReplace({ block, courseId, onChange }: { block: ContentBlock; courseId: string; onChange: (block: ContentBlock) => void }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [buttonPosition, setButtonPosition] = useState<{ left: number; top: number; maxWidth: number; visible: boolean }>();
  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const stage = frame.closest<HTMLElement>("[data-slide-stage]");
    const object = [...(stage?.querySelectorAll<HTMLElement>("[data-slide-object-frame]") ?? [])].find((element) => element.dataset.slideObjectId === block.id);
    const measure = () => {
      const canvasRect = frame.getBoundingClientRect();
      const stageRect = stage?.getBoundingClientRect() ?? canvasRect;
      const left = Math.max(0, canvasRect.left, stageRect.left);
      const top = Math.max(0, canvasRect.top, stageRect.top);
      const right = Math.min(window.innerWidth, canvasRect.right, stageRect.right);
      const bottom = Math.min(window.innerHeight, canvasRect.bottom, stageRect.bottom);
      if (right <= left || bottom <= top || !object) {
        setButtonPosition((current) => current ? { ...current, visible: false } : undefined);
        return;
      }
      const objectRect = object.getBoundingClientRect();
      const buttonRect = buttonRef.current?.getBoundingClientRect();
      const maxWidth = Math.max(0, right - left - 16);
      const width = Math.min(buttonRect?.width || 144, maxWidth);
      const height = buttonRect?.height || 32;
      const below = objectRect.bottom + 12;
      const topPosition = below + height <= bottom - 8 ? below : objectRect.top - height - 12;
      setButtonPosition({
        left: Math.max(left + 8, Math.min(objectRect.left + (objectRect.width - width) / 2, right - width - 8)),
        top: Math.max(top + 8, Math.min(topPosition, bottom - height - 8)),
        maxWidth,
        visible: objectRect.right > left && objectRect.left < right && objectRect.bottom > top && objectRect.top < bottom,
      });
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(frame);
    if (stage) observer?.observe(stage);
    if (object) observer?.observe(object);
    if (buttonRef.current) observer?.observe(buttonRef.current);
    const mutationObserver = typeof MutationObserver === "undefined" ? null : new MutationObserver(measure);
    if (object) mutationObserver?.observe(object, { attributes: true, attributeFilter: ["style"] });
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => { observer?.disconnect(); mutationObserver?.disconnect(); window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure, true); };
  }, [block.id]);

  return <div ref={frameRef} data-slide-canvas-media-tools className="pointer-events-none absolute inset-0 z-20" onPointerDown={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
    <Button ref={buttonRef} type="button" size="sm" variant="outline" aria-label="Replace media" aria-haspopup="dialog" aria-expanded={open} className="pointer-events-auto fixed bg-white shadow-md" style={{ left: buttonPosition?.left, top: buttonPosition?.top, maxWidth: buttonPosition?.maxWidth, visibility: buttonPosition?.visible ? "visible" : "hidden" }} onClick={() => setOpen(true)}><ImagePlus size={15} aria-hidden="true" />Replace media</Button>
    {open && <Dialog open title="Replace media" onClose={() => setOpen(false)} className="pointer-events-auto h-[min(800px,calc(100dvh-24px))] max-h-[calc(100dvh-24px)] w-[calc(100vw-24px)] max-w-5xl overflow-hidden sm:h-[min(800px,calc(100dvh-48px))] sm:max-h-[calc(100dvh-48px)] sm:w-[calc(100vw-48px)]" contentClassName="flex h-full min-h-0 flex-col p-3 sm:p-4">
      <SlideMediaPicker block={block} courseId={courseId} onChange={onChange} embedded onClose={() => setOpen(false)} />
    </Dialog>}
  </div>;
}
