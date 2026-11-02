"use client";
import { Move } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SlideSelection, SelectionCorner } from "./use-slide-selection";

export function SlideSelectionOverlay({ selection }: { selection: SlideSelection }) {
  const box = selection.bounds;
  return <>
    {selection.marquee && <div data-slide-marquee className="pointer-events-none absolute z-[1200] border border-indigo-500 bg-indigo-500/10" style={{ left: `${selection.marquee.left}%`, top: `${selection.marquee.top}%`, width: `${selection.marquee.width}%`, height: `${selection.marquee.height}%` }} />}
    {box && selection.selectedIds.length > 1 && <div data-slide-selection className="pointer-events-none absolute z-[1100] border-2 border-indigo-500" style={{ left: `${box.left}%`, top: `${box.top}%`, width: `${box.right - box.left}%`, height: `${box.bottom - box.top}%` }}>
      {selection.editable && <>
        <Button variant="outline" size="icon" aria-label="Move selected objects" title="Move selected objects" className={`pointer-events-auto absolute left-1/2 size-7 -translate-x-1/2 touch-none p-0 ${box.top < 7 ? "top-1" : "-top-8"}`} onPointerDown={selection.startMove}><Move size={14} /></Button>
        {(["top-left", "top-right", "bottom-left", "bottom-right"] as SelectionCorner[]).map((corner) => <Button key={corner} variant="outline" size="icon" aria-label={`Resize selection ${corner.replace("-", " ")}`} className="pointer-events-auto absolute size-3 min-h-0 min-w-0 -translate-x-1/2 -translate-y-1/2 touch-none rounded-none border-indigo-500 bg-white p-0" style={{ left: corner.endsWith("left") ? 0 : "100%", top: corner.startsWith("top") ? 0 : "100%", cursor: corner === "top-left" || corner === "bottom-right" ? "nwse-resize" : "nesw-resize" }} onPointerDown={(event) => selection.startResize(event, corner)} onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
          event.preventDefault(); event.stopPropagation(); const step = event.shiftKey ? 10 : 1;
          selection.resizeKey(corner, event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0, event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0);
        }} />)}
      </>}
    </div>}
  </>;
}
