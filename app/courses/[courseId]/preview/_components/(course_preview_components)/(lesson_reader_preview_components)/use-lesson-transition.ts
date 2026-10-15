"use client";

import { useLayoutEffect, useRef } from "react";
import type { PreviewDevice, PreviewOrientation } from "../preview-types";

type SectionDirection = "next" | "previous";

export function useLessonTransition({ selectedLessonId, active, device, orientation, lessonBodyScrollRefs, selectLesson, getLessonNavigationLockMessage }: {
  selectedLessonId: string | null; active: boolean; device: PreviewDevice; orientation: PreviewOrientation;
  lessonBodyScrollRefs: { current: Map<string, HTMLDivElement> };
  selectLesson: (lessonId: string) => void;
  getLessonNavigationLockMessage: (lessonId: string) => string | null;
}) {
  const readerRef = useRef<HTMLDivElement>(null);
  const pending = useRef<{ from: string; to: string; direction: SectionDirection } | null>(null);
  const cancelTransition = useRef<(() => void) | null>(null);

  function navigateSection(lessonId: string, direction: SectionDirection) {
    if (!selectedLessonId || lessonId === selectedLessonId || getLessonNavigationLockMessage(lessonId)) return;
    cancelTransition.current?.();
    pending.current = { from: selectedLessonId, to: lessonId, direction };
    selectLesson(lessonId);
  }

  useLayoutEffect(() => {
    const request = pending.current;
    pending.current = null;
    const reader = readerRef.current;
    const incoming = selectedLessonId ? lessonBodyScrollRefs.current.get(selectedLessonId)?.parentElement : undefined;
    const outgoing = request ? lessonBodyScrollRefs.current.get(request.from)?.parentElement : undefined;
    const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!active || !request || request.to !== selectedLessonId || !reader || !incoming || !outgoing || motion?.matches || !incoming.animate || !outgoing.animate) return;
    const bounds = reader.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;

    // The outgoing lesson overlays the reader briefly; it never increases scroll height.
    outgoing.style.display = "flex";
    outgoing.style.position = "absolute";
    outgoing.style.inset = "0";
    const direction = request.direction === "next" ? 1 : -1;
    const options: KeyframeAnimationOptions = { duration: 420, easing: "cubic-bezier(0.22, 1, 0.36, 1)" };
    const entering = incoming.animate([{ transform: `translateY(${direction * 100}%)` }, { transform: "translateY(0)" }], options);
    const leaving = outgoing.animate([{ transform: "translateY(0)" }, { transform: `translateY(${-direction * 100}%)` }], options);
    let stopped = false;
    const stop = () => {
      if (stopped) return;
      stopped = true;
      entering.onfinish = null;
      entering.cancel();
      leaving.cancel();
      outgoing.style.removeProperty("display");
      outgoing.style.removeProperty("position");
      outgoing.style.removeProperty("inset");
      observer?.disconnect();
      window.clearTimeout(timeout);
      window.removeEventListener("resize", checkSize);
      motion?.removeEventListener?.("change", stop);
      if (cancelTransition.current === stop) cancelTransition.current = null;
    };
    const checkSize = () => {
      const next = reader.getBoundingClientRect();
      if (next.width !== bounds.width || next.height !== bounds.height) stop();
    };
    entering.onfinish = stop;
    const timeout = window.setTimeout(stop, 520);
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(checkSize);
    observer?.observe(reader);
    window.addEventListener("resize", checkSize);
    motion?.addEventListener?.("change", stop);
    cancelTransition.current = stop;
    return stop;
  }, [active, device, orientation, selectedLessonId, lessonBodyScrollRefs]);

  return { readerRef, navigateSection };
}
