"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { isPopupBranch } from "./popup-context";
import { popupFadeDuration, popupMouseLeaveDelay } from "./popup-motion";

/** Shared lifecycle for anchored popovers and movable nonmodal settings panels. */
export function usePopupBehavior({ open, onOpenChange, panelRef, triggerRef, id, busy = false, closeOnMouseLeave = true }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  panelRef: RefObject<HTMLElement | null>;
  triggerRef?: RefObject<HTMLElement | null>;
  id: string;
  busy?: boolean;
  closeOnMouseLeave?: boolean;
}) {
  const [present, setPresent] = useState(open);
  if (open && !present) setPresent(true);
  const mouseLeaveTimer = useRef<number | null>(null);
  const cancelMouseLeave = useCallback(() => {
    if (mouseLeaveTimer.current !== null) window.clearTimeout(mouseLeaveTimer.current);
    mouseLeaveTimer.current = null;
  }, []);

  const close = useCallback((restoreFocus = true) => {
    if (busy) return;
    cancelMouseLeave();
    onOpenChange(false);
    if (restoreFocus) triggerRef?.current?.focus({ preventScroll: true });
  }, [busy, cancelMouseLeave, onOpenChange, triggerRef]);

  const scheduleMouseLeave = useCallback((event: Pick<PointerEvent, "pointerType" | "buttons" | "relatedTarget">) => {
    if (!closeOnMouseLeave || !open || busy || event.pointerType !== "mouse" || event.buttons !== 0) return;
    const target = event.relatedTarget;
    if (target instanceof Node && (triggerRef?.current?.contains(target) || panelRef.current?.contains(target) || isPopupBranch(target, id))) return;
    cancelMouseLeave();
    // Allow crossing the gap to a portaled panel. Never dismiss a nested modal.
    mouseLeaveTimer.current = window.setTimeout(() => {
      mouseLeaveTimer.current = null;
      if (document.querySelector(`dialog[open][data-popup-ancestors~="${id}"], [data-popup-ancestors~="${id}"] [role="dialog"][aria-modal="true"]`)) return;
      if (panelRef.current?.querySelector('input[type="color"]:focus, select:focus')) return;
      close(false);
    }, popupMouseLeaveDelay);
  }, [closeOnMouseLeave, open, busy, triggerRef, panelRef, id, cancelMouseLeave, close]);

  useEffect(() => cancelMouseLeave, [open, busy, closeOnMouseLeave, cancelMouseLeave]);

  useEffect(() => {
    if (open || !present) return;
    if (panelRef.current?.contains(document.activeElement)) triggerRef?.current?.focus({ preventScroll: true });
    const delay = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 0 : popupFadeDuration;
    const timer = window.setTimeout(() => setPresent(false), delay);
    return () => window.clearTimeout(timer);
  }, [open, present, panelRef, triggerRef]);

  useEffect(() => {
    if (!open || !present || busy) return;
    function outside(event: Event) {
      if (event.target instanceof Node && !panelRef.current?.contains(event.target) && !triggerRef?.current?.contains(event.target) && !isPopupBranch(event.target, id)) close(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented || isPopupBranch(event.target, id) || panelRef.current?.querySelector('[role="menu"]')) return;
      event.preventDefault();
      close();
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    document.addEventListener("keydown", escape);
    const trigger = triggerRef?.current;
    // Also support independently rendered triggers used by draggable panels.
    trigger?.addEventListener("pointerenter", cancelMouseLeave);
    trigger?.addEventListener("pointerleave", scheduleMouseLeave);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
      document.removeEventListener("keydown", escape);
      trigger?.removeEventListener("pointerenter", cancelMouseLeave);
      trigger?.removeEventListener("pointerleave", scheduleMouseLeave);
    };
  }, [open, present, busy, close, id, panelRef, triggerRef, cancelMouseLeave, scheduleMouseLeave]);

  return { present, close, cancelMouseLeave, scheduleMouseLeave };
}
