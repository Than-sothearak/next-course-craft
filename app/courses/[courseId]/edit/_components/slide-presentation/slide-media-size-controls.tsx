"use client";

import { Input } from "@/components/ui/input";
import { fitSlideMediaFrame, resolveSlideFrame, slideObjectArea, type SlideSize } from "@/lib/editor/slide-design";
import { isSlideMediaObject, resolveSlideDisplayMedia, resolveSlideMedia } from "@/lib/editor/slide-objects";
import type { ContentBlock } from "@/lib/schemas/block";

export function SlideMediaSizeControls({ block, index, total, area = slideObjectArea, onChange }: { block: ContentBlock; index: number; total: number; area?: SlideSize; onChange: (block: ContentBlock) => void }) {
  if (!isSlideMediaObject(block)) return null;
  const media = resolveSlideDisplayMedia(block);
  const original = resolveSlideMedia(block);
  const frame = resolveSlideFrame(block, index, total, area);
  const scale = media ? Number((frame.width * area.width / media.width).toFixed(2)) : 100;
  return (
    <div className="space-y-2 border-t pt-3" aria-label="Media proportions">
      <p className="text-xs text-slate-500">Resize proportionally using the corner handle, width, height, or scale.</p>
      {media && <label className="block text-xs text-slate-600">Scale %
        <Input aria-label="Media scale" type="number" min={0.1} step={0.01} value={scale} onChange={(event) => {
          const value = Number(event.target.value);
          if (!Number.isFinite(value) || value <= 0) return;
          onChange({ ...block, slideFrame: fitSlideMediaFrame(frame, media, { width: media.width * value / area.width }, area) });
        }} className="mt-1 h-8" />
        <span className="mt-1 block text-[11px] text-slate-500">Original: {original?.width} × {original?.height}</span>
      </label>}
    </div>
  );
}
