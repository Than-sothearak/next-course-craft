"use client";

import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import { isSlideMediaObject } from "@/lib/editor/slide-objects";
import type { ContentBlock } from "@/lib/schemas/block";
import { SlideNumberSettingInput } from "./slide-number-setting-input";

export function SlideMediaOverlayControls({ block, onChange }: { block: ContentBlock; onChange: (block: ContentBlock) => void }) {
  if (!isSlideMediaObject(block)) return null;
  const overlay = block.slideMediaOverlay ?? { color: "#000000", opacity: 0 };
  return <div className="space-y-2" aria-label="Media color overlay settings">
    <div className="space-y-1 text-xs text-slate-600">Overlay color<ColorPicker aria-label="Media overlay color" allowGradient value={overlay.color} onChange={(color) => onChange({ ...block, slideMediaOverlay: { ...overlay, color } })} /></div>
    <label className="block space-y-1 text-xs text-slate-600">Overlay opacity (%)<SlideNumberSettingInput aria-label="Media overlay opacity" min={0} max={100} value={overlay.opacity} onValueChange={(opacity) => onChange({ ...block, slideMediaOverlay: { ...overlay, opacity } })} /></label>
    {block.slideMediaOverlay && <Button variant="ghost" size="sm" onClick={() => onChange({ ...block, slideMediaOverlay: undefined })}>Remove media overlay</Button>}
  </div>;
}
