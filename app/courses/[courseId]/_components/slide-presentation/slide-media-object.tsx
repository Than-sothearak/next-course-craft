"use client";

import { CirclePlay } from "lucide-react";
import type { ContentBlock } from "@/lib/schemas/block";
import { resolveSlideMedia } from "@/lib/editor/slide-objects";
import { PreviewImage } from "../../preview/preview-image";
import { SlideMediaPlayer } from "./slide-media-player";
import { isSlideVideoFile, resolveSlideCrop } from "@/lib/editor/slide-crop";
import { SlideColorOverlay } from "./slide-color-overlay";
import type { MediaPlaybackProgress } from "@/lib/export/media-playback";

export function SlideMediaObject({ block, onDimensions, onDurationChange, onVideoEnded, requireFullPlayback = false, trackProgress = false, completed = false, initialProgress, onProgress }: {
  block: Extract<ContentBlock, { type: "image" | "video" }>;
  onDimensions?: (dimensions: { width: number; height: number }) => void;
  onDurationChange?: (duration: number | null) => void;
  onVideoEnded?: () => void;
  requireFullPlayback?: boolean;
  trackProgress?: boolean;
  completed?: boolean;
  initialProgress?: MediaPlaybackProgress;
  onProgress?: (progress: MediaPlaybackProgress) => void;
}) {
  const dimensions = resolveSlideMedia(block);
  const videoFile = block.type === "video" && isSlideVideoFile(block);
  const imageRatio = block.type === "image" ? block.data.imageAspectRatio : undefined;
  const aspect = imageRatio ? Number(imageRatio.split("/")[0]) / Number(imageRatio.split("/")[1]) : undefined;
  return (
    <div data-slide-media-object className={block.type === "image" ? "relative flex h-full w-full items-center justify-center" : "relative h-full w-full"} style={{ backgroundColor: "transparent", containerType: aspect ? "size" : undefined }}>
      {block.type === "image" ? (
        <div data-image-frame data-image-fit={block.data.imageFit ?? "contain"} data-image-position={block.data.imagePosition ?? "center"} data-image-aspect-ratio={imageRatio} className="h-full w-full" style={aspect ? { width: `min(100cqw, calc(100cqh * ${aspect}))`, height: `min(100cqh, calc(100cqw / ${aspect}))`, flexShrink: 0 } : undefined}>
          <PreviewImage src={block.data.src} alt={block.data.alt} caption={block.data.caption} className="h-full w-full object-contain" imageFit={block.data.imageFit} imagePosition={block.data.imagePosition} fitFrame dimensions={dimensions} crop={resolveSlideCrop(block)} onDimensions={onDimensions} />
        </div>
      ) : videoFile ? (
        <SlideMediaPlayer key={block.data.src} block={block} onDimensions={onDimensions} onDurationChange={onDurationChange} onEnded={onVideoEnded} requireFullPlayback={requireFullPlayback} trackProgress={trackProgress} completed={completed} initialProgress={initialProgress} onProgress={onProgress} />
      ) : (
        <a href={block.data.src} target="_blank" rel="noreferrer" onClick={onVideoEnded} className="flex h-full w-full items-center justify-center gap-3 bg-slate-950 text-white">
          <CirclePlay size={36} /><span className="text-sm font-medium">Open video</span>
        </a>
      )}
      {!videoFile && block.slideMediaOverlay && <SlideColorOverlay {...block.slideMediaOverlay} />}
    </div>
  );
}
