"use client";

import { Expand, Minimize } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SlideCanvasFullscreen({ fullscreen, onToggle }: { fullscreen: boolean; onToggle: () => void }) {
  return <Button type="button" variant="ghost" size="icon" aria-label={fullscreen ? "Exit full screen" : "Present full screen"} title={fullscreen ? "Exit full screen" : "Present full screen"} onClick={onToggle} className="absolute right-3 top-7 z-30 size-9 text-current hover:bg-black/10">
    {fullscreen ? <Minimize size={19} /> : <Expand size={19} />}
  </Button>;
}
