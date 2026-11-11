"use client";

import { useEffect, useRef } from "react";
import type { ContentBlock, ProcessMediaLayout } from "@/lib/schemas/block";
import { defaultProcessMediaLayout, resolveProcessStepAssets } from "@/lib/editor/process-steps";
import { FileAttachmentLink } from "@/components/file-attachment-link";
import { useSlidePlaybackActive } from "@/app/courses/[courseId]/_components/slide-presentation/slide-playback-context";

type Media = NonNullable<Extract<ContentBlock, { type: "processSteps" }>["data"]["steps"][number]["media"]>;
type Step = Extract<ContentBlock, { type: "processSteps" }>["data"]["steps"][number];

export function ProcessStepAssets({ step, layout, presentation = false, decorative = false }: { step: Step; layout?: ProcessMediaLayout; presentation?: boolean; decorative?: boolean }) {
  const { media, attachment } = resolveProcessStepAssets(step);
  return <div className="space-y-3">
    {media && <ProcessStepMedia media={media} layout={layout} presentation={presentation} decorative={decorative} />}
    {attachment && <FileAttachmentLink href={attachment.src} fileName={attachment.fileName} size={attachment.size} />}
  </div>;
}

export function ProcessStepMedia({ media, layout = defaultProcessMediaLayout, presentation = false, decorative = false }: { media: Media; layout?: ProcessMediaLayout; presentation?: boolean; decorative?: boolean }) {
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
    return <div data-process-media-frame className="mx-auto max-w-full overflow-hidden rounded-lg bg-slate-100" style={{ width: layout.width, aspectRatio: `${layout.width} / ${layout.height}` }}><img src={media.src} alt={media.fileName} className="h-full w-full" style={{ objectFit: layout.fit, objectPosition: layout.position }} /></div>;
  }
  if (media.mimeType.startsWith("video/")) return <div data-process-media-frame className="mx-auto max-w-full overflow-hidden rounded-lg bg-slate-100" style={{ width: layout.width, aspectRatio: `${layout.width} / ${layout.height}` }}><video ref={(node) => { playerRef.current = node; }} key={media.src} src={media.src} controls={!decorative} playsInline preload={decorative ? "none" : "metadata"} aria-label={media.fileName} className="h-full w-full" style={{ objectFit: layout.fit, objectPosition: layout.position }} /></div>;
  if (media.mimeType.startsWith("audio/")) return <audio ref={(node) => { playerRef.current = node; }} key={media.src} src={media.src} controls={!decorative} preload={decorative ? "none" : "metadata"} aria-label={media.fileName} className="w-full" />;
  return <FileAttachmentLink href={media.src} fileName={media.fileName} size={media.size} />;
}
