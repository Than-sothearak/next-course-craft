"use client";

import { useEffect, useState, type RefObject } from "react";
import type { ContentBlock } from "@/lib/schemas/block";
import type { SlideSize } from "@/lib/editor/slide-design";
import { readSlideObjectClipboard, serializeSlideObject, slideObjectClipboardType } from "@/lib/editor/slide-clipboard";

const modalSelector = 'dialog[open], [role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]';
const textSelector = 'input, textarea, select, [contenteditable="true"], [contenteditable=""], [role="textbox"]';

function canHandleClipboard(event: ClipboardEvent, scope: HTMLElement | null): boolean {
  if (event.defaultPrevented || !scope?.isConnected) return false;
  const target = event.target instanceof Element ? event.target : document.activeElement;
  if (target?.closest(textSelector) || document.activeElement?.closest(textSelector)) return false;
  // Only the topmost editor handles an event when popup editors or pickers are open.
  const modal = [...document.querySelectorAll(modalSelector)].at(-1) ?? null;
  return scope.closest(modalSelector) === modal;
}

export function useSlideObjectClipboard({ scopeRef, courseId, blocks, selectedId, area, onPaste, onSelect }: {
  scopeRef: RefObject<HTMLElement | null>;
  courseId: string;
  blocks: ContentBlock[];
  selectedId: string | null;
  area: SlideSize;
  onPaste: (source: ContentBlock) => string;
  onSelect: (id: string) => void;
}) {
  const [notice, setNotice] = useState<{ message: string; error: boolean } | null>(null);
  useEffect(() => {
    function copy(event: ClipboardEvent) {
      if (!canHandleClipboard(event, scopeRef.current) || !event.clipboardData || window.getSelection()?.isCollapsed === false) return;
      const index = blocks.findIndex((block) => block.id === selectedId);
      if (index < 0) return;
      try {
        const text = serializeSlideObject(courseId, blocks[index], index, blocks.length, area);
        try { event.clipboardData.setData(slideObjectClipboardType, text); } catch { /* Plain text supports browsers without custom clipboard types. */ }
        event.clipboardData.setData("text/plain", text);
        event.preventDefault();
        setNotice({ message: "Object copied. Paste it onto this slide or another slide.", error: false });
      } catch {
        setNotice({ message: "The object could not be copied. Select it and try again.", error: true });
      }
    }
    function paste(event: ClipboardEvent) {
      if (!canHandleClipboard(event, scopeRef.current) || !event.clipboardData) return;
      try {
        const source = readSlideObjectClipboard(event.clipboardData.getData(slideObjectClipboardType) || event.clipboardData.getData("text/plain"), courseId);
        if (!source) return;
        event.preventDefault();
        onSelect(onPaste(source));
        setNotice({ message: "Object pasted.", error: false });
      } catch (error) {
        event.preventDefault();
        setNotice({ message: error instanceof Error ? error.message : "The object could not be pasted.", error: true });
      }
    }
    document.addEventListener("copy", copy);
    document.addEventListener("paste", paste);
    return () => { document.removeEventListener("copy", copy); document.removeEventListener("paste", paste); };
  }, [scopeRef, courseId, blocks, selectedId, area, onPaste, onSelect]);
  return notice;
}
