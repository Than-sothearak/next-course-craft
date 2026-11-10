"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "./button";

/** A compact, nonmodal panel kept above card badges and inside the viewport. */
export function Popover({ open, onOpenChange, title, triggerLabel, trigger, children, footer, disabled = false, busy = false, portalTarget, anchorElement, placement = "center", ownerId, layer = 70, initialFocusSelector, triggerActive = false }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  triggerLabel: string;
  trigger: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  disabled?: boolean;
  busy?: boolean;
  portalTarget?: Element | null;
  anchorElement?: Element | null;
  placement?: "center" | "side";
  ownerId?: string;
  layer?: number;
  initialFocusSelector?: string;
  triggerActive?: boolean;
}) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [present, setPresent] = useState(open);
  if (open && !present) setPresent(true);
  const [position, setPosition] = useState<{ left: number; top: number; maxHeight: number } | null>(null);

  useEffect(() => {
    if (open) return;
    if (panelRef.current?.contains(document.activeElement)) triggerRef.current?.focus({ preventScroll: true });
    const delay = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 0 : 150;
    const timer = window.setTimeout(() => { setPresent(false); setPosition(null); }, delay);
    return () => window.clearTimeout(timer);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !present) return;
    const panel = panelRef.current;
    const triggerElement = triggerRef.current;
    if (!panel || !triggerElement) return;
    function place() {
      if (!panel || !triggerElement) return;
      const viewport = window.visualViewport;
      const width = viewport?.width ?? window.innerWidth;
      const height = viewport?.height ?? window.innerHeight;
      const offsetLeft = viewport?.offsetLeft ?? 0;
      const offsetTop = viewport?.offsetTop ?? 0;
      const anchor = (anchorElement ?? triggerElement).getBoundingClientRect();
      const maxHeight = Math.min(560, height - 24);
      const panelHeight = Math.min(panel.offsetHeight, maxHeight);
      setPosition({
        left: Math.max(offsetLeft + 12, Math.min(placement === "side" ? (anchor.right + 8 + panel.offsetWidth <= offsetLeft + width - 12 ? anchor.right + 8 : anchor.left - panel.offsetWidth - 8) : anchor.right - panel.offsetWidth, offsetLeft + width - panel.offsetWidth - 12)),
        top: placement === "side" ? Math.max(offsetTop + 12, Math.min(anchor.top, offsetTop + height - panelHeight - 12)) : offsetTop + Math.max(12, (height - panelHeight) / 2),
        maxHeight,
      });
    }
    place();
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(place) : null;
    observer?.observe(panel);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    window.visualViewport?.addEventListener("resize", place);
    window.visualViewport?.addEventListener("scroll", place);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      window.visualViewport?.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("scroll", place);
    };
  }, [open, present, anchorElement, placement]);

  const positioned = position !== null;
  useEffect(() => {
    if (open && present && positioned) panelRef.current?.querySelector<HTMLElement>(initialFocusSelector ?? "button")?.focus({ preventScroll: true });
  }, [open, present, positioned, initialFocusSelector]);

  function close(restoreFocus = true) {
    if (busy) return;
    onOpenChange(false);
    if (restoreFocus) triggerRef.current?.focus({ preventScroll: true });
  }

  useEffect(() => {
    if (!open || !present || busy) return;
    function outside(event: Event) {
      if (event.target instanceof Node && !panelRef.current?.contains(event.target) && !triggerRef.current?.contains(event.target)) onOpenChange(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented || panelRef.current?.querySelector('[role="menu"]')) return;
      event.preventDefault();
      onOpenChange(false);
      triggerRef.current?.focus({ preventScroll: true });
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open, present, busy, onOpenChange]);

  return <>
    <Button ref={triggerRef} variant={triggerActive ? "secondary" : "ghost"} size="icon" aria-label={triggerLabel} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined} disabled={disabled} onClick={() => open ? close() : onOpenChange(true)} className="size-8 text-slate-400 hover:text-slate-700">{trigger}</Button>
    {present && typeof document !== "undefined" && createPortal(
      <section ref={panelRef} id={id} role="dialog" aria-modal="false" aria-labelledby={`${id}-title`} aria-hidden={!open} inert={!open} data-state={open ? "open" : "closed"} data-card-popover data-popover-owner={ownerId} onKeyDown={(event) => {
        if (event.key === "Escape" && !event.defaultPrevented) { event.preventDefault(); event.stopPropagation(); close(); }
      }} className="card-actions-popover fixed z-[70] flex max-h-[560px] w-80 max-w-[calc(100vw-24px)] flex-col rounded-xl border border-slate-200 bg-white text-slate-900 shadow-[0_16px_48px_rgba(15,23,42,0.18)]" style={{ ...position, zIndex: layer, visibility: position ? "visible" : "hidden" }}>
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5">
          <h2 id={`${id}-title`} className="text-sm font-semibold">{title}</h2>
          <Button variant="ghost" size="icon" disabled={busy} onClick={() => close()} aria-label={`Close ${title.toLowerCase()}`} className="size-7"><X size={15} aria-hidden="true" /></Button>
        </header>
        <div ref={bodyRef} data-popover-body className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">{children}</div>
        {footer && <footer className="flex shrink-0 items-center justify-end gap-2 rounded-b-xl border-t border-slate-100 bg-slate-50 px-4 py-2.5">{footer}</footer>}
      </section>, portalTarget ?? document.body,
    )}
  </>;
}
