"use client";

import type { KeyboardEvent, PointerEvent } from "react";
import { Move, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { slideResizeHandles, type SlideResizeHandle } from "@/lib/editor/slide-transform";

export type SlideTransformKind = "move" | "resize" | "rotate";

export function SlideObjectTransformHandles({ type, insetTools, rotation, onStart, onKeyDown }: {
  type: string;
  insetTools: boolean;
  rotation: number;
  onStart: (event: PointerEvent<HTMLButtonElement>, kind: SlideTransformKind, handle?: SlideResizeHandle) => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>, kind: SlideTransformKind, handle?: SlideResizeHandle) => void;
}) {
  return <>
    <span aria-hidden="true" className="pointer-events-none absolute left-1/2 z-20 w-px bg-indigo-500" style={{ top: insetTools ? 0 : -24, height: 24 }} />
    <Button type="button" variant="outline" size="icon" aria-label={`Rotate ${type} object`} title={`Rotate (${rotation}°). Hold Shift to snap to 15°. Arrow keys adjust rotation.`}
      data-slide-rotation-handle onPointerDown={(event) => onStart(event, "rotate")} onKeyDown={(event) => onKeyDown(event, "rotate")}
      className="absolute left-1/2 z-30 size-6 -translate-x-1/2 touch-none rounded-full border-indigo-500 bg-white text-indigo-700 shadow-sm" style={{ top: insetTools ? 12 : -36, cursor: "grab", scale: "calc(1 / var(--slide-canvas-scale, 1))" }}><RotateCw size={13} aria-hidden="true" /></Button>
    <Button type="button" variant="outline" size="icon" aria-label={`Move ${type} object`} title="Drag to move object. Arrow keys move by 1 px; Shift moves by 10 px."
      onPointerDown={(event) => onStart(event, "move")} onKeyDown={(event) => onKeyDown(event, "move")}
      className="absolute right-3 z-30 size-6 touch-none rounded border-indigo-500 bg-white text-indigo-700 shadow-sm" style={{ top: insetTools ? 12 : -36, cursor: "grab", scale: "calc(1 / var(--slide-canvas-scale, 1))" }}><Move size={14} aria-hidden="true" /></Button>
    {slideResizeHandles.map((handle) => <Button key={handle.id} type="button" variant="outline" size="icon"
      aria-label={`Resize ${type} object${handle.id === "bottom-right" ? "" : ` from ${handle.id.replace("-", " ")}`}`}
      title={`Resize from ${handle.id.replace("-", " ")}. Arrow keys adjust size.`} data-slide-resize-handle={handle.id}
      onPointerDown={(event) => onStart(event, "resize", handle.id)} onKeyDown={(event) => onKeyDown(event, "resize", handle.id)}
      className="absolute z-30 size-5 -translate-x-1/2 -translate-y-1/2 touch-none rounded-none border-0 bg-transparent p-1 shadow-none hover:bg-indigo-100/60"
      style={{ left: handle.x === -1 ? 3 : handle.x === 1 ? "calc(100% - 3px)" : "50%", top: handle.y === -1 ? 3 : handle.y === 1 ? "calc(100% - 3px)" : "50%", cursor: handle.cursor, scale: "calc(1 / var(--slide-canvas-scale, 1))" }}>
      <span aria-hidden="true" className="size-2.5 shrink-0 border border-indigo-600 bg-white" />
    </Button>)}
  </>;
}
