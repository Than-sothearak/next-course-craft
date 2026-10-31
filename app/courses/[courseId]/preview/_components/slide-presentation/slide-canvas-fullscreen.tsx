"use client";

import { Expand, Minimize } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SlideCanvasFullscreen({ fullscreen, onToggle }: { fullscreen: boolean; onToggle: () => void }) {
  return <Button type="button" variant="ghost" size="icon" aria-label={fullscreen ? "Exit full screen" : "Present full screen"} title={fullscreen ? "Exit full screen" : "Present full screen"} onClick={onToggle} className="absolute right-3 top-3 z-30 size-8 bg-white/90 text-slate-700 shadow-sm hover:bg-white">
    {fullscreen ? <Minimize size={16} /> : <Expand size={16} />}
  </Button>;
}
