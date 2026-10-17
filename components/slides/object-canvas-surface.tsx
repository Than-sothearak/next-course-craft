"use client";
import { useRef, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { masterSafeBounds, renderSlideMaster } from "@/lib/slides/master-schema";
import { MasterSurface } from "./master-surface";
import { Button } from "@/components/ui/button";
import type { LearningBlock, LearningPage, ObjectPlacement } from "@/lib/slides/blocks";
import { layerActive } from "@/lib/slides/blocks";
import { defaultObjectPlacement, moveCanvasObject, resizeCanvasObject } from "@/lib/slides/object-canvas";
import { readableSlideColor, type SlideTheme } from "@/lib/slides/themes";

type Props = {
  page: LearningPage; slideTitle?: string; slideOrder?: number; theme: SlideTheme; time?: number; selectedId?: string | null; disabled?: boolean;
  onSelect?: (id: string) => void; onPlacement?: (id: string, placement: ObjectPlacement, group?: string) => void;
  onDelete?: (id: string) => void; renderObject: (block: LearningBlock) => ReactNode;
};
type Gesture = { pointerId: number; id: string; mode: "move" | "resize"; x: number; y: number; scale: number; scaleY: number; placement: ObjectPlacement; group: string };
export function ObjectCanvasSurface({ page, theme, slideTitle, slideOrder, time, selectedId, disabled, onSelect, onPlacement, onDelete, renderObject }: Props) {
  const sceneRef = useRef<HTMLDivElement>(null), gestureRef = useRef<Gesture | null>(null);
  const master = renderSlideMaster(theme.master, page.masterOverrides), safe = masterSafeBounds(master);
  const factor = page.resolution === "fullHd" ? 1.5 : 1;
  function begin(event: PointerEvent<HTMLButtonElement>, block: LearningBlock, placement: ObjectPlacement, mode: Gesture["mode"]) {
    if (event.button !== 0 || disabled || block.locked || !onPlacement) return;
    const bounds = sceneRef.current?.getBoundingClientRect();
    if (!bounds?.width) return;
    event.preventDefault(); onSelect?.(block.id); event.currentTarget.setPointerCapture(event.pointerId);
    gestureRef.current = { pointerId: event.pointerId, id: block.id, mode, x: event.clientX, y: event.clientY, scale: bounds.width / 1280, scaleY: bounds.height ? bounds.height / 720 : bounds.width / 1280, placement, group: `canvas:${crypto.randomUUID()}` };
  }
  function drag(event: PointerEvent<HTMLButtonElement>) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId || disabled) return;
    const dx = (event.clientX - gesture.x) / gesture.scale, dy = (event.clientY - gesture.y) / gesture.scaleY;
    onPlacement?.(gesture.id, gesture.mode === "move" ? moveCanvasObject(gesture.placement, gesture.placement.x + dx, gesture.placement.y + dy) : resizeCanvasObject(gesture.placement, gesture.placement.width + dx, gesture.placement.height + dy), gesture.group);
  }
  const end = () => { gestureRef.current = null; };
  return <div data-learning-page data-object-canvas style={{ width: 1280 * factor, height: 720 * factor, position: "relative", overflow: "hidden", background: theme.backgroundColor }}>
    <div data-master-design style={{ position: "absolute", width: 1280, height: 720, transform: `scale(${factor})`, transformOrigin: "top left" }}>
    <MasterSurface master={master} title={slideTitle} order={slideOrder} numbering={page.numbering} />
    <div ref={sceneRef} data-canvas-design data-master-safe-area style={{ position: "absolute", left: safe.x, top: safe.y, width: safe.width, height: safe.height, overflow: "hidden", transformOrigin: "top left", color: readableSlideColor(theme.backgroundColor), fontFamily: theme.fontFamily === "serif" ? "Georgia, serif" : "Arial, sans-serif" }}>
      {page.layers.map((block, index) => {
        if (time === undefined ? !block.visible : !layerActive(block, Math.min(time, page.duration - .001), page.duration)) return null;
        const placement = block.placement ?? defaultObjectPlacement(block.kind, index), appearance = block.appearance ?? {};
        const style: CSSProperties = { position: "absolute", left: placement.x * safe.width / 1280, top: placement.y * safe.height / 720, width: placement.width * safe.width / 1280, height: placement.height * safe.height / 720, transform: `rotate(${placement.rotation}deg)`, zIndex: placement.zIndex, opacity: appearance.opacity ?? 1, overflow: "hidden", overflowWrap: "anywhere", pointerEvents: appearance.opacity === 0 ? "none" : undefined, color: appearance.color, background: block.kind === "shape" ? undefined : appearance.backgroundColor, borderRadius: appearance.radius, borderColor: appearance.borderColor, borderWidth: block.kind === "shape" ? 0 : appearance.borderWidth, borderStyle: appearance.borderWidth ? "solid" : undefined, fontSize: appearance.fontSize, fontWeight: appearance.bold ? 700 : undefined, fontStyle: appearance.italic ? "italic" : undefined, textAlign: appearance.textAlign, fontFamily: appearance.fontFamily === "serif" ? "Georgia, serif" : appearance.fontFamily ? "Arial, sans-serif" : undefined };
        return <section key={block.id} data-layer-id={block.id} data-canvas-object data-selected={selectedId === block.id ? "true" : undefined} style={style}>
          <div className="@container h-full min-h-0 w-full overflow-auto" data-object-content>{renderObject(block)}</div>
          {onSelect && <><Button variant="ghost" aria-label={`Edit ${block.name}`} aria-pressed={selectedId === block.id} disabled={disabled || block.locked} className={`absolute inset-0 h-full w-full cursor-move touch-none rounded-none bg-transparent p-0 hover:bg-indigo-500/5 ${selectedId === block.id ? "border-2 border-indigo-500" : "border border-transparent hover:border-indigo-300"}`} onClick={() => onSelect(block.id)} onPointerDown={(event) => begin(event, block, placement, "move")} onPointerMove={drag} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}
            onKeyDown={(event) => {
              if (disabled || block.locked) return;
              if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); onDelete?.(block.id); return; }
              const dx = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0, dy = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
              if (dx || dy) { event.preventDefault(); const step = event.shiftKey ? 10 : 1; onPlacement?.(block.id, moveCanvasObject(placement, placement.x + dx * step, placement.y + dy * step)); }
            }}><span className="sr-only">Edit {block.name}</span></Button>
            {selectedId === block.id && !block.locked && <Button size="icon" aria-label={`Resize ${block.name}`} disabled={disabled} className="absolute right-0 bottom-0 size-6 min-h-6 cursor-nwse-resize touch-none rounded-sm border-2 border-white bg-indigo-600 p-0" onPointerDown={(event) => begin(event, block, placement, "resize")} onPointerMove={drag} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} onKeyDown={(event) => { const dw = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0, dh = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0; if (dw || dh) { event.preventDefault(); const step = event.shiftKey ? 10 : 1; onPlacement?.(block.id, resizeCanvasObject(placement, placement.width + dw * step, placement.height + dh * step)); } }}><span aria-hidden="true">↘</span></Button>}
          </>}
        </section>;
      })}
      {!page.layers.length && onSelect && <p className="pointer-events-none absolute inset-0 grid place-items-center text-xl text-slate-400">Blank canvas · Insert a prebuilt object</p>}
    </div>
    </div>
  </div>;
}
