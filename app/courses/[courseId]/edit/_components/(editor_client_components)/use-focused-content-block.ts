"use client";

import { useEffect, useRef } from "react";
import { editorBlockElementId } from "@/lib/editor/lesson-location";

export function focusContentBlock(element: HTMLElement) {
  element.scrollIntoView({ block: "start", behavior: "auto" });
  const editable = element.querySelector<HTMLElement>('[contenteditable="true"]');
  if (editable) {
    editable.focus({ preventScroll: true });
    return;
  }
  const settings = element.querySelector<HTMLButtonElement>('button[aria-label="Open content settings"]');
  if (settings) {
    settings.click();
    settings.focus({ preventScroll: true });
  } else {
    const input = element.querySelector<HTMLElement>('textarea, input:not([type="hidden"]):not([type="file"]), select');
    (input ?? element).focus({ preventScroll: true });
  }
}

export function useFocusedContentBlock(lessonId: string | undefined, activeLessonId: string | null, blockId: string | undefined) {
  const focusedTarget = useRef<string | null>(null);
  useEffect(() => {
    if (!lessonId || lessonId !== activeLessonId || !blockId) return;
    const target = `${lessonId}:${blockId}`;
    if (focusedTarget.current === target) return;
    const frame = window.requestAnimationFrame(() => {
      const element = document.getElementById(editorBlockElementId(blockId));
      if (!element) return;
      focusContentBlock(element);
      focusedTarget.current = target;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [lessonId, activeLessonId, blockId]);
}
