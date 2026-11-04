"use client";

import { useEffect, useMemo, useRef, type SyntheticEvent } from "react";
import { createMediaPlaybackGuard, mediaProgressSource, type MediaPlaybackProgress } from "@/lib/export/media-playback";

type Tracking = { enabled?: boolean; completed?: boolean; initial?: MediaPlaybackProgress; onProgress?: (progress: MediaPlaybackProgress) => void };

export function useRequiredMediaPlayback(src: string, required: boolean, onEnded?: () => void, active = true, tracking: Tracking = {}) {
  const source = useMemo(() => mediaProgressSource(src), [src]);
  const { guard } = useMemo(() => ({ src, required, guard: createMediaPlaybackGuard() }), [src, required]);
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const initial = tracking.enabled && tracking.initial?.source === source ? tracking.initial : undefined;

  useEffect(() => {
    if (active && mediaRef.current) guard.restore(mediaRef.current, initial);
  }, [active, guard, initial]);

  function update(media: HTMLMediaElement) {
    mediaRef.current = media;
    if (!active || !tracking.enabled) return;
    guard.restore(media, initial);
    const progress = { ...guard.progress(media), source };
    if (progress.seconds > 0) tracking.onProgress?.(progress);
  }

  return {
    events: {
      onLoadedMetadata: (event: SyntheticEvent<HTMLMediaElement>) => update(event.currentTarget),
      onSeeking: (event: Pick<SyntheticEvent<HTMLMediaElement>, "currentTarget">) => {
        mediaRef.current = event.currentTarget;
        if (active && required) { guard.restore(event.currentTarget, initial); guard.seeking(event.currentTarget); }
      },
      onSeeked: (event: SyntheticEvent<HTMLMediaElement>) => {
        if (active && required) guard.seeking(event.currentTarget);
      },
      onTimeUpdate: (event: SyntheticEvent<HTMLMediaElement>) => {
        if (active && required) guard.update(event.currentTarget);
        update(event.currentTarget);
      },
      onEnded: (event: SyntheticEvent<HTMLMediaElement>) => {
        if (!active || ((required || tracking.enabled) && !tracking.completed && !guard.finish(event.currentTarget))) return false;
        onEnded?.();
        return true;
      },
    },
  };
}
