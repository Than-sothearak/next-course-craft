"use client";

import { useState, type ReactNode } from "react";
import { PanelsTopLeft, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { SlideStage } from "../../../_components/slide-presentation/slide-stage";
import { defaultSlideSize, type SlideSize } from "@/lib/editor/slide-design";

const zoomLevels = [25, 50, 75, 100, 125, 150, 175, 200];

export function SlideEditorCanvas({ label, zoom, onZoomChange, size = defaultSlideSize, children }: {
  label: ReactNode;
  zoom?: number;
  size?: SlideSize;
  onZoomChange: (zoom: number | undefined) => void;
  children: ReactNode;
}) {
  const [scale, setScale] = useState(1);
  const percent = zoom ?? Math.round(scale * 100);
  const smaller = [...zoomLevels].reverse().find((level) => level < percent);
  const larger = zoomLevels.find((level) => level > percent);
  return <section className="min-w-0 self-start overflow-hidden rounded-none border border-slate-200 bg-slate-100">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600">
      <span className="flex min-w-0 items-center gap-2 truncate font-medium"><PanelsTopLeft size={14} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-slate-400" />{label}</span>
      <div role="group" aria-label="Canvas zoom controls" className="flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5">
        <Button type="button" variant="ghost" size="icon" aria-label="Zoom out" title="Zoom out" disabled={smaller === undefined} onClick={() => onZoomChange(smaller)} className="size-7 rounded-md hover:bg-white"><ZoomOut size={14} aria-hidden="true" /></Button>
        <Select aria-label="Canvas zoom" value={zoom ?? "fit"} onChange={(event) => onZoomChange(event.target.value === "fit" ? undefined : Number(event.target.value))} className="h-7 w-28 border-0 bg-transparent py-1 text-[11px] font-medium shadow-none">
          <option value="fit">{zoom === undefined ? `Fit (${Math.round(scale * 100)}%)` : "Fit to window"}</option>
          {zoomLevels.map((level) => <option key={level} value={level}>{level}%</option>)}
        </Select>
        <Button type="button" variant="ghost" size="icon" aria-label="Zoom in" title="Zoom in" disabled={larger === undefined} onClick={() => onZoomChange(larger)} className="size-7 rounded-md hover:bg-white"><ZoomIn size={14} aria-hidden="true" /></Button>
      </div>
    </div>
    <SlideStage size={size} fillWidth zoom={zoom} onScaleChange={setScale} style={{ aspectRatio: `${size.width} / ${size.height}` }} className="max-h-[760px] min-h-[340px] w-full bg-slate-100" canvasClassName="rounded-none border border-slate-300">
      {children}
    </SlideStage>
  </section>;
}
