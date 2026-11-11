"use client";

import { useEffect, useRef } from "react";
import type { ContentBlock } from "@/lib/schemas/block";
import { FileAttachmentLink } from "@/components/file-attachment-link";
import { useSlidePlaybackActive } from "@/app/courses/[courseId]/_components/slide-presentation/slide-playback-context";

type Media = NonNullable<Extract<ContentBlock, { type: "processSteps" }>["data"]["steps"][number]["media"]>;

export function ProcessStepMedia({ media, presentation = false, decorative = false }: { media: Media; presentation?: boolean; decorative?: boolean }) {
  const playerRef = useRef<HTMLMediaElement>(null);
  const slideActive = useSlidePlaybackActive();
  const active = (!presentation || slideActive) && !decorative;
  useEffect(() => {
    const player = playerRef.current;
    if (!active && player && !player.paused) player.pause();
    return () => { if (player && !player.paused) player.pause(); };
  }, [active, media.src]);
  if (media.mimeType.startsWith("image/")) {
    // Course assets are also remapped to static paths and blob URLs by offline exports.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={media.src} alt={media.fileName} className="mx-auto max-h-96 max-w-full rounded-lg object-contain" />;
  }
  if (media.mimeType.startsWith("video/")) return <video ref={(node) => { playerRef.current = node; }} key={media.src} src={media.src} controls={!decorative} playsInline preload={decorative ? "none" : "metadata"} aria-label={media.fileName} className="max-h-96 w-full rounded-lg" />;
  if (media.mimeType.startsWith("audio/")) return <audio ref={(node) => { playerRef.current = node; }} key={media.src} src={media.src} controls={!decorative} preload={decorative ? "none" : "metadata"} aria-label={media.fileName} className="w-full" />;
  return <FileAttachmentLink href={media.src} fileName={media.fileName} size={media.size} />;
}
