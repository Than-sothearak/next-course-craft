"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Presentation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublishMenu } from "@/components/publish-menu";
import type { SlideItem } from "@/app/courses/[courseId]/_components/slide-presentation/slide-navigation";
import { SlidePresentationContext } from "./slide-presentation-context";

export function SlidePresentationPreview({
  courseId, title, slides, selectedId, onSelect, getLockMessage,
  standalone, canPublish, onBack, onEdit, menuOpen, onMenuOpenChange, menu, children,
}: {
  courseId: string;
  title: string;
  slides: readonly SlideItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  getLockMessage: (id: string) => string | null;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  menu: ReactNode;
  standalone: boolean;
  canPublish: boolean;
  onBack?: () => void;
  onEdit?: () => void;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const index = slides.findIndex((slide) => slide.id === selectedId);

  useEffect(() => {
    const update = () => setFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (menuOpen) {
        if (event.key === "Escape") onMenuOpenChange(false);
        return;
      }
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      if (target instanceof Element && target.closest("input, textarea, select, audio, video, [contenteditable], [role=dialog], [role=slider], [role=tablist]")) return;
      const direction = event.key === "ArrowRight" || event.key === "PageDown" ? 1
        : event.key === "ArrowLeft" || event.key === "PageUp" ? -1 : 0;
      if (!direction) return;
      const next = slides[index + direction];
      if (!next || getLockMessage(next.id)) return;
      event.preventDefault();
      onSelect(next.id);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [getLockMessage, index, menuOpen, onMenuOpenChange, onSelect, slides]);

  async function toggleFullscreen() {
    if (document.fullscreenElement === rootRef.current) await document.exitFullscreen();
    else await rootRef.current?.requestFullscreen?.();
  }

  return (
    <div ref={rootRef} data-presentation-view data-fullscreen={fullscreen || undefined} className={`relative flex min-h-0 min-w-0 flex-col overflow-hidden bg-white text-slate-900 ${fullscreen ? "h-dvh w-dvw" : "h-full w-full"}`}>
      {!fullscreen && <header className="flex min-h-14 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 sm:gap-3 sm:px-5">
        {onBack && <Button type="button" variant="ghost" size="icon" aria-label="Back" onClick={onBack}><ArrowLeft size={17} /></Button>}
        <Presentation size={18} aria-hidden="true" className="shrink-0 text-indigo-600" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{title}</p>
          <p className="text-[11px] text-slate-500">Interactive presentation</p>
        </div>
        {onEdit && <Button type="button" variant="outline" size="sm" onClick={onEdit} className="h-8">Edit</Button>}
        {!standalone && canPublish && <PublishMenu courseId={courseId} title={title} className="h-8" />}
      </header>}
      <SlidePresentationContext.Provider value={{ slides, selectedId, onSelect, getLockMessage, menuOpen, onMenuOpenChange, menu, fullscreen, onToggleFullscreen: () => void toggleFullscreen() }}>
        <div className="relative flex min-h-0 min-w-0 flex-1">{children}</div>
      </SlidePresentationContext.Provider>
    </div>
  );
}
