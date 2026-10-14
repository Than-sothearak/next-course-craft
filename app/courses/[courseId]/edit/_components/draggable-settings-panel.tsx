"use client";

import {
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

type FloatingPosition = { left: number; top: number };

export function DraggableSettingsPanel({
  id,
  title,
  side,
  anchorRef,
  panelClassName = "w-[min(380px,calc(100vw-2rem))]",
  bodyClassName = "",
  children,
}: {
  id: string;
  title: string;
  side: "left" | "right";
  anchorRef?: RefObject<HTMLElement | null>;
  panelClassName?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const [position, setPosition] = useState<FloatingPosition | null>(null);

  useLayoutEffect(() => {
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
  }, [anchorRef]);

  function startDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
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

  return createPortal(
    <section
      ref={panelRef}
      id={id}
      role="dialog"
      aria-label={title}
      style={{
        position: "fixed",
        zIndex: 9999,
        maxHeight: "min(78vh, 680px)",
        ...positionStyle,
      }}
      className={`flex max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-700 shadow-2xl ${panelClassName}`}
    >
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
        className="flex min-h-11 shrink-0 touch-none cursor-grab items-center gap-2 border-b border-slate-200 bg-slate-50 px-3.5 text-xs font-semibold text-slate-600 active:cursor-grabbing"
      >
        <GripVertical size={15} aria-hidden="true" className="text-slate-400" />
        <span>{title}</span>
      </div>
      <div className={`min-h-0 overflow-y-auto overscroll-contain p-4 ${bodyClassName}`}>
        {children}
      </div>
    </section>,
    document.body,
  );
}
