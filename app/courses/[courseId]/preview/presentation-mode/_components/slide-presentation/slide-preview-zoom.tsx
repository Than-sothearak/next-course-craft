"use client";

import { Expand, Minimize } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

const zoomLevels = [25, 50, 75, 100, 120, 150, 175, 200, 250, 300];

export function SlidePreviewZoom({ zoom, onZoomChange, fullscreen, onToggleFullscreen }: {
  zoom?: number;
  onZoomChange: (zoom: number | undefined) => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  return <div role="group" aria-label="Presentation zoom controls" className="flex shrink-0 items-center gap-1">
    <Select aria-label="Presentation zoom" value={zoom ?? "fit"} onChange={(event) => onZoomChange(event.target.value === "fit" ? undefined : Number(event.target.value))} className="h-8 w-36 bg-white py-1 pl-2 pr-8 text-xs shadow-sm">
      <option value="fit">Fit to screen</option>
      {zoomLevels.map((level) => <option key={level} value={level}>{level}%</option>)}
    </Select>
    {zoom !== undefined && <Button type="button" variant="ghost" size="icon" aria-label={fullscreen ? "Exit full screen" : "Present full screen"} title={fullscreen ? "Exit full screen" : "Present full screen"} onClick={onToggleFullscreen} className="size-8 bg-white/90 text-slate-700 hover:bg-white">
      {fullscreen ? <Minimize size={15} /> : <Expand size={15} />}
    </Button>}
  </div>;
}
