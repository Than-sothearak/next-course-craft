"use client";

import { useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button, type ButtonProps } from "./button";
import { cn } from "@/lib/utils";
import { PopupAncestorsContext } from "./popup-context";
import { usePopupBehavior } from "./use-popup-behavior";

/** Shared nonmodal settings and action popup, including presence, dismissal and focus. */
export function Popover({ open: controlledOpen, onOpenChange, title, triggerLabel, trigger, children, footer, disabled = false, busy = false, portalTarget, anchorElement, placement = "center", ownerId, layer = 70, initialFocusSelector, triggerActive = false, closeOnMouseLeave = true, variant = "settings", triggerProps, panelClassName, bodyClassName }: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  triggerLabel: string;
  trigger: ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  footer?: ReactNode;
  disabled?: boolean;
  busy?: boolean;
  portalTarget?: Element | null;
  anchorElement?: Element | null;
  placement?: "center" | "side" | "bottom" | "top";
  ownerId?: string;
  layer?: number;
  initialFocusSelector?: string;
  triggerActive?: boolean;
  closeOnMouseLeave?: boolean;
  variant?: "settings" | "menu" | "panel";
  triggerProps?: Omit<ButtonProps, "children" | "aria-expanded" | "aria-controls" | "aria-haspopup">;
  panelClassName?: string;
  bodyClassName?: string;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const changeOpen = useCallback((next: boolean) => {
    setInternalOpen(next);
    onOpenChange?.(next);
  }, [onOpenChange]);
  const id = useId();
  const ancestors = useContext(PopupAncestorsContext);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const { present, close, cancelMouseLeave, scheduleMouseLeave } = usePopupBehavior({ open, onOpenChange: changeOpen, panelRef, triggerRef, id, busy, closeOnMouseLeave });
  const [position, setPosition] = useState<{ left: number; top: number; maxHeight: number } | null>(null);

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
      const below = anchor.bottom + 8;
      const above = anchor.top - panelHeight - 8;
      const preferAbove = placement === "top";
      const anchoredTop = preferAbove
        ? (above >= offsetTop + 12 ? above : below)
        : (below + panelHeight <= offsetTop + height - 12 ? below : above);
      setPosition({
        left: Math.max(offsetLeft + 12, Math.min(placement === "side" ? (anchor.right + 8 + panel.offsetWidth <= offsetLeft + width - 12 ? anchor.right + 8 : anchor.left - panel.offsetWidth - 8) : anchor.right - panel.offsetWidth, offsetLeft + width - panel.offsetWidth - 12)),
        top: placement === "center" ? offsetTop + Math.max(12, (height - panelHeight) / 2) : Math.max(offsetTop + 12, Math.min(placement === "side" ? anchor.top : anchoredTop, offsetTop + height - panelHeight - 12)),
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
    if (open && present && positioned) panelRef.current?.querySelector<HTMLElement>(initialFocusSelector ?? (variant === "menu" ? '[role="menuitem"]:not(:disabled)' : "button"))?.focus({ preventScroll: true });
  }, [open, present, positioned, initialFocusSelector, variant]);

  return <>
    <Button variant={triggerActive ? "secondary" : "ghost"} size="icon" {...triggerProps} ref={triggerRef} aria-label={triggerLabel} aria-haspopup={variant === "menu" ? "menu" : "dialog"} aria-expanded={open} aria-controls={open ? id : undefined} disabled={disabled || triggerProps?.disabled} onPointerEnter={cancelMouseLeave} onPointerLeave={scheduleMouseLeave} onClick={(event) => { triggerProps?.onClick?.(event); if (!event.defaultPrevented) { cancelMouseLeave(); if (open) close(); else changeOpen(true); } }} className={cn("size-8 text-slate-400 hover:text-slate-700", triggerProps?.className)}>{trigger}</Button>
    {present && typeof document !== "undefined" && createPortal(
      <PopupAncestorsContext.Provider value={[...ancestors, id]}>
      <section ref={panelRef} id={id} role={variant === "menu" ? "menu" : "dialog"} aria-modal={variant === "menu" ? undefined : false} aria-labelledby={variant === "settings" ? `${id}-title` : undefined} aria-label={variant === "settings" ? undefined : title} aria-hidden={!open} inert={!open} data-state={open ? "open" : "closed"} data-ui-popover data-popup-ancestors={ancestors.join(" ") || undefined} data-card-popover={variant === "settings" ? "" : undefined} data-popover-owner={ownerId} onPointerEnter={cancelMouseLeave} onPointerLeave={scheduleMouseLeave} onClick={(event) => {
        if (variant === "menu" && event.target instanceof Element && event.target.closest('[role="menuitem"]') && !event.defaultPrevented) close();
      }} onKeyDown={(event) => {
        if (!event.currentTarget.contains(event.target as Node)) return;
        if (event.key === "Escape" && !event.defaultPrevented) { event.preventDefault(); event.stopPropagation(); close(); }
        if (variant !== "menu" || event.defaultPrevented || !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
        const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? []);
        if (!items.length) return;
        event.preventDefault();
        const current = items.indexOf(document.activeElement as HTMLElement);
        const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
        items[next]?.focus();
      }} className={cn("ui-popover fixed z-[70] flex max-h-[560px] w-80 max-w-[calc(100vw-24px)] flex-col rounded-xl border border-slate-200 bg-white text-slate-900 shadow-[0_16px_48px_rgba(15,23,42,0.18)]", panelClassName)} style={{ ...position, zIndex: layer, visibility: position ? "visible" : "hidden" }}>
        {variant === "settings" && <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5">
          <h2 id={`${id}-title`} className="text-sm font-semibold">{title}</h2>
          <Button variant="ghost" size="icon" disabled={busy} onClick={() => close()} aria-label={`Close ${title.toLowerCase()}`} className="size-7"><X size={15} aria-hidden="true" /></Button>
        </header>}
        <div ref={bodyRef} data-popover-body className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain", variant === "menu" ? "p-1.5" : "p-4", bodyClassName)}>{typeof children === "function" ? children(() => close()) : children}</div>
        {footer && <footer className="flex shrink-0 items-center justify-end gap-2 rounded-b-xl border-t border-slate-100 bg-slate-50 px-4 py-2.5">{footer}</footer>}
      </section>
      </PopupAncestorsContext.Provider>, portalTarget ?? document.fullscreenElement ?? document.body,
    )}
  </>;
}
