"use client";

import {
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { GripVertical } from "lucide-react";
import { SettingsSectionActions, SettingsSectionsProvider } from "@/components/ui/settings-section";
import { PopupAncestorsContext } from "@/components/ui/popup-context";
import { usePopupBehavior } from "@/components/ui/use-popup-behavior";

type FloatingPosition = { left: number; top: number };

export function DraggableSettingsPanel({
  id,
  open,
  onOpenChange,
  triggerRef,
  busy = false,
  title,
  settingsLabel,
  side,
  anchorRef,
  panelClassName = "w-[min(380px,calc(100vw-2rem))]",
  bodyClassName = "",
  children,
}: {
  id: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerRef: RefObject<HTMLElement | null>;
  busy?: boolean;
  title: string;
  settingsLabel: string;
  side: "left" | "right";
  anchorRef?: RefObject<HTMLElement | null>;
  panelClassName?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const ancestors = useContext(PopupAncestorsContext);
  const { present, close, cancelMouseLeave, scheduleMouseLeave } = usePopupBehavior({ open, onOpenChange, panelRef, triggerRef, id, busy });
  const dragRef = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const [position, setPosition] = useState<FloatingPosition | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const anchor = anchorRef?.current;
    const panel = panelRef.current;
    if (!anchor || !panel) return;
    const anchorRect = anchor.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const gutter = 8;
    const gap = 12;
    const maxLeft = Math.max(gutter, window.innerWidth - panelRect.width - gutter);
    const maxTop = Math.max(gutter, window.innerHeight - panelRect.height - gutter);
    const leftOfAnchor = anchorRect.left - panelRect.width - gap;
    const rightOfAnchor = anchorRect.right + gap;
    const preferredLeft = leftOfAnchor >= gutter ? leftOfAnchor : rightOfAnchor;
    const top = anchorRect.top + anchorRect.height / 2 - panelRect.height / 2;
    setPosition({
      left: Math.min(maxLeft, Math.max(gutter, preferredLeft)),
      top: Math.min(maxTop, Math.max(gutter, top)),
    });
  }, [anchorRef, open]);

  useEffect(() => {
    if (open && present) panelRef.current?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
  }, [open, present]);

  function startDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    cancelMouseLeave();
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };
    setPosition({ left: rect.left, top: rect.top });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function movePanel(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    const gutter = 8;
    const maxLeft = Math.max(gutter, window.innerWidth - rect.width - gutter);
    const maxTop = Math.max(gutter, window.innerHeight - rect.height - gutter);
    setPosition({
      left: Math.min(maxLeft, Math.max(gutter, event.clientX - drag.offsetX)),
      top: Math.min(maxTop, Math.max(gutter, event.clientY - drag.offsetY)),
    });
  }

  function stopDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function moveWithKeyboard(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    event.preventDefault();
    const gutter = 8;
    const maxLeft = Math.max(gutter, window.innerWidth - rect.width - gutter);
    const maxTop = Math.max(gutter, window.innerHeight - rect.height - gutter);
    const current = position ?? { left: rect.left, top: rect.top };
    const distance = event.shiftKey ? 48 : 16;
    const left = current.left + (event.key === "ArrowLeft" ? -distance : event.key === "ArrowRight" ? distance : 0);
    const top = current.top + (event.key === "ArrowUp" ? -distance : event.key === "ArrowDown" ? distance : 0);
    setPosition({
      left: Math.min(maxLeft, Math.max(gutter, left)),
      top: Math.min(maxTop, Math.max(gutter, top)),
    });
  }

  const positionStyle = position
    ? { left: `${position.left}px`, top: `${position.top}px` }
    : side === "left"
      ? { left: "24px", top: "50%", transform: "translateY(-50%)" }
      : { right: "24px", top: "50%", transform: "translateY(-50%)" };

  if (!present) return null;

  return createPortal(
    <PopupAncestorsContext.Provider value={[...ancestors, id]}>
    <SettingsSectionsProvider>
    <section
      ref={panelRef}
      id={id}
      role="dialog"
      aria-label={title}
      aria-hidden={!open}
      inert={!open}
      data-ui-popover
      data-state={open ? "open" : "closed"}
      data-popup-ancestors={ancestors.join(" ") || undefined}
      onPointerEnter={cancelMouseLeave}
      onPointerLeave={scheduleMouseLeave}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !event.defaultPrevented && event.currentTarget.contains(event.target as Node)) { event.preventDefault(); event.stopPropagation(); close(); }
      }}
      style={{
        position: "fixed",
        zIndex: 9999,
        maxHeight: "min(78vh, 680px)",
        ...positionStyle,
      }}
      className={`ui-popover flex max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-700 shadow-2xl ${panelClassName}`}
    >
      <div data-settings-panel-header className="flex shrink-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 border-b border-slate-200 bg-slate-50 px-3 py-1">
      <div
        aria-label={`Move ${title} popup`}
        role="group"
        tabIndex={0}
        title="Drag to move; use arrow keys"
        onPointerDown={startDrag}
        onPointerMove={movePanel}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
        onKeyDown={moveWithKeyboard}
        className="flex min-h-9 min-w-0 flex-1 basis-[140px] touch-none cursor-grab items-center gap-2 text-xs font-semibold text-slate-600 active:cursor-grabbing"
      >
        <GripVertical size={15} aria-hidden="true" className="shrink-0 text-slate-400" />
        <span>{title}</span>
      </div>
      <div className="ml-auto"><SettingsSectionActions label={settingsLabel} /></div>
      </div>
      <div className={`min-h-0 overflow-y-auto overscroll-contain p-4 ${bodyClassName}`}>
        {children}
      </div>
    </section>
    </SettingsSectionsProvider>
    </PopupAncestorsContext.Provider>,
    document.body,
  );
}
