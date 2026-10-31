"use client";

import { CirclePlay } from "lucide-react";
import type { ContentBlock } from "@/lib/schemas/block";
import { resolveSlideMedia } from "@/lib/editor/slide-objects";
import { PreviewImage } from "../../preview/preview-image";
import { SlideMediaPlayer } from "./slide-media-player";
import { isSlideVideoFile, resolveSlideCrop } from "@/lib/editor/slide-crop";

export function SlideMediaObject({ block, onDimensions, onVideoEnded }: {
  block: Extract<ContentBlock, { type: "image" | "video" }>;
  onDimensions?: (dimensions: { width: number; height: number }) => void;
  onVideoEnded?: () => void;
}) {
  const dimensions = resolveSlideMedia(block);
  const videoFile = block.type === "video" && isSlideVideoFile(block);
  return (
    <div data-slide-media-object className="h-full w-full" style={{ backgroundColor: "transparent" }}>
      {block.type === "image" ? (
        <PreviewImage src={block.data.src} alt={block.data.alt} caption={block.data.caption} className="h-full w-full object-contain" fitFrame dimensions={dimensions} crop={resolveSlideCrop(block)} onDimensions={onDimensions} />
      ) : videoFile ? (
        <SlideMediaPlayer key={block.data.src} block={block} onDimensions={onDimensions} onEnded={onVideoEnded} />
      ) : (
        <a href={block.data.src} target="_blank" rel="noreferrer" onClick={onVideoEnded} className="flex h-full w-full items-center justify-center gap-3 bg-slate-950 text-white">
          <CirclePlay size={36} /><span className="text-sm font-medium">Open video</span>
        </a>
      )}
    </div>
  );
}
