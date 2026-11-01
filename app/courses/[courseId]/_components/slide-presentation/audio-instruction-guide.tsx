"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { GripVertical, MoveDiagonal2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { backgroundPaint, solidColor, textPaint } from "@/lib/color";
import { audioGuideConnector, fitAudioGuidePoint, fitAudioGuidePopup, type AudioGuideLayout, type AudioInstructionGuide as Guide } from "@/lib/editor/audio-instruction-guide";
import { defaultSlideAnimation } from "@/lib/editor/slide-animation";
import { useSlideObjectAnimation } from "./use-slide-object-animation";

type Kind = "point" | "popup" | "resize";
type Drag = { pointerId: number; kind: Kind; x: number; y: number; bounds: DOMRect; layout: AudioGuideLayout };

export function AudioInstructionGuide({ id, canvas, guide, open, editing, onOpen, onClose, onChange }: {
  id: string; canvas: HTMLElement; guide: Guide; open: boolean; editing: boolean; onOpen: () => void; onClose: () => void; onChange?: (change: Partial<Guide>) => void;
}) {
  const [draft, setDraft] = useState<AudioGuideLayout | null>(null);
  const popupRef = useRef<HTMLElement>(null);
  const animation = guide.animation ?? defaultSlideAnimation;
  // Learner delays are scheduled against audio events; editor Preview uses the authored delay.
  const animationEffect = useSlideObjectAnimation(popupRef, { ...animation, delay: editing ? animation.delay : 0 }, open && !editing);
  const draftRef = useRef<AudioGuideLayout | null>(null), drag = useRef<Drag | null>(null);
  const layout = draft ?? { point: guide.point, popup: guide.popup };
  const connector = audioGuideConnector(layout);
  const editable = editing && Boolean(onChange);
  function start(event: PointerEvent<HTMLElement>, kind: Kind) {
    if (!editable || event.button !== 0) return;
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    event.preventDefault(); event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drag.current = { pointerId: event.pointerId, kind, x: event.clientX, y: event.clientY, bounds, layout };
  }
  function update(layout: AudioGuideLayout, kind: Kind, dx: number, dy: number): AudioGuideLayout {
    return kind === "point" ? { ...layout, point: fitAudioGuidePoint({ x: layout.point.x + dx, y: layout.point.y + dy }) }
      : { ...layout, popup: fitAudioGuidePopup(layout.popup, kind === "popup" ? { x: layout.popup.x + dx, y: layout.popup.y + dy } : { width: layout.popup.width + dx, height: layout.popup.height + dy }) };
  }
  function move(event: PointerEvent<HTMLElement>) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    event.stopPropagation();
    const next = update(current.layout, current.kind, (event.clientX - current.x) / current.bounds.width * 100, (event.clientY - current.y) / current.bounds.height * 100);
    draftRef.current = next; setDraft(next);
  }
  function finish(event: PointerEvent<HTMLElement>, cancelled = false) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    event.stopPropagation(); drag.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!cancelled && draftRef.current && JSON.stringify(draftRef.current) !== JSON.stringify(current.layout)) onChange?.(draftRef.current);
    draftRef.current = null; setDraft(null);
  }
  function keyboard(event: KeyboardEvent<HTMLElement>, kind: Kind) {
    if (!editable) return;
    const step = event.shiftKey ? 5 : 1;
    const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
    const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
    if (!dx && !dy) return;
    event.preventDefault(); event.stopPropagation();
    const next = update(layout, kind, dx, dy);
    if (JSON.stringify(next) !== JSON.stringify(layout)) onChange?.(next);
  }
  const handlers = (kind: Kind) => ({ onPointerDown: (event: PointerEvent<HTMLElement>) => start(event, kind), onPointerMove: move, onPointerUp: (event: PointerEvent<HTMLElement>) => finish(event), onPointerCancel: (event: PointerEvent<HTMLElement>) => finish(event, true), onLostPointerCapture: (event: PointerEvent<HTMLElement>) => finish(event, true), onKeyDown: (event: KeyboardEvent<HTMLElement>) => keyboard(event, kind) });
  return createPortal(<div data-audio-guide={id} className="pointer-events-none absolute inset-0 z-[1100] overflow-hidden" onPointerDown={(event) => event.stopPropagation()}>
    {open && <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible"><path d={`M ${layout.point.x} ${layout.point.y} L ${connector.x} ${connector.y}`} fill="none" stroke={solidColor(guide.pointColor)} strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinecap="round" /></svg>}
    <Button {...handlers("point")} variant="ghost" size="icon" aria-label={editable ? "Move audio guide point" : `Show audio guide: ${guide.title || "Audio guide"}`} title={editable ? "Drag the point, or use arrow keys" : "Show audio guide"} aria-expanded={open} aria-controls={`audio-guide-${id}`} onClick={() => { if (!editable) onOpen(); }} className={`pointer-events-auto absolute size-5 min-h-0 min-w-0 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white p-0 shadow-md ${editable ? "touch-none" : ""}`} style={{ left: `${layout.point.x}%`, top: `${layout.point.y}%`, ...backgroundPaint(guide.pointColor), cursor: editable ? "grab" : "pointer" }}><span aria-hidden="true" className="size-1.5 rounded-full bg-white" /></Button>
    {open && <Card ref={popupRef} id={`audio-guide-${id}`} data-slide-object-animation={animationEffect} data-slide-object-id={`audio-guide-${id}`} role="dialog" aria-label={guide.title || "Audio guide"} data-audio-guide-popup className="pointer-events-auto absolute flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border-slate-200 shadow-xl" style={{ left: `${layout.popup.x}%`, top: `${layout.popup.y}%`, width: `${layout.popup.width}%`, height: `${layout.popup.height}%`, ...backgroundPaint(guide.backgroundColor), color: solidColor(guide.textColor) }} onKeyDown={(event) => { if (event.key === "Escape" && !editing) { event.preventDefault(); event.stopPropagation(); onClose(); } }}>
      <div className="flex shrink-0 items-center gap-1 border-b border-slate-200/60 px-2 py-1">
        {editable && <Button {...handlers("popup")} variant="ghost" size="icon" aria-label="Move audio guide popup" title="Drag the popup, or use arrow keys" className="size-6 min-h-0 shrink-0 touch-none p-0" style={{ cursor: "grab", color: "inherit" }}><GripVertical size={14} aria-hidden="true" /></Button>}
        <p className="min-w-0 flex-1 truncate px-1 text-xs font-semibold" style={textPaint(guide.textColor)}>{guide.title || "Audio guide"}</p>
        {!editing && <Button variant="ghost" size="icon" aria-label="Close audio guide" className="size-6 min-h-0 shrink-0 p-0" style={{ color: "inherit" }} onClick={onClose}><X size={14} aria-hidden="true" /></Button>}
      </div>
      <CardContent className={`min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap break-words p-3 text-sm leading-relaxed ${editable ? "pb-6" : ""}`} style={textPaint(guide.textColor)}>{guide.text}</CardContent>
      {editable && <Button {...handlers("resize")} variant="ghost" size="icon" aria-label="Resize audio guide popup" title="Drag to resize, or use arrow keys" className="absolute bottom-0 right-0 size-6 min-h-0 touch-none rounded-none rounded-tl-lg bg-white/80 p-0" style={{ cursor: "nwse-resize", color: solidColor(guide.textColor) }}><MoveDiagonal2 size={13} aria-hidden="true" /></Button>}
    </Card>}
  </div>, canvas);
}
