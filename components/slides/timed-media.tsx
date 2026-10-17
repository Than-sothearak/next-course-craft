"use client";
import { useEffect, useRef, useState } from "react";
import type { LearningBlock } from "@/lib/slides/blocks";
import { monitorLayerMuted, type PreviewAudioMonitor } from "@/lib/slides/timeline";

export function TimedMedia({ block, time, playing, onComplete, onDuration, fit = false, monitor }: { block: Extract<LearningBlock, { kind: "audio" | "video" }>; time?: number; playing?: boolean; onComplete?: () => void; onDuration?: (duration: number) => void; fit?: boolean; monitor?: PreviewAudioMonitor }) {
  const ref = useRef<HTMLMediaElement | null>(null);
  const blockedRef = useRef<string | null>(null);
  const completeRef = useRef(onComplete);
  const [blockedSource, setBlockedSource] = useState<string | null>(null);
  const blocked = blockedSource === block.src;
  useEffect(() => { completeRef.current = onComplete; }, [onComplete]);
  useEffect(() => {
    const element = ref.current;
    return () => { if (element && !element.paused) element.pause(); };
  }, [block.src]);
  const monitoredMute = monitor ? monitorLayerMuted(monitor, block.id) : undefined;
  useEffect(() => {
    if (!ref.current) return;
    ref.current.volume = Math.max(0, Math.min(1, block.volume * (monitor?.volume ?? 1)));
    if (monitoredMute !== undefined) ref.current.muted = monitoredMute;
  }, [block.volume, monitor?.volume, monitoredMute, block.src]);
  useEffect(() => {
    const element = ref.current;
    if (!element || time === undefined) return;
    const position = block.trimStart + Math.max(0, time - block.start);
    const end = block.trimEnd ?? (Number.isFinite(element.duration) ? element.duration : Infinity);
    if (position >= end && !block.loop) { if (playing && !element.paused) completeRef.current?.(); element.pause(); return; }
    const target = block.loop && Number.isFinite(end) && end > block.trimStart ? block.trimStart + (position - block.trimStart) % (end - block.trimStart) : position;
    if (Number.isFinite(target) && Math.abs(element.currentTime - target) > .35) element.currentTime = target;
    if (playing && element.paused && blockedRef.current !== block.src) void element.play().catch(() => { blockedRef.current = block.src; setBlockedSource(block.src); });
    if (!playing) element.pause();
  }, [time, playing, block.src, block.start, block.trimStart, block.trimEnd, block.loop]);
  if (!block.src) return <p className="rounded-lg border border-dashed p-6 text-sm">Choose {block.kind} from the media library.</p>;
  const props = {
    src: block.src, controls: true, preload: "metadata" as const,
    onLoadedMetadata: () => { if (ref.current) { ref.current.currentTime = block.trimStart; ref.current.volume = block.volume * (monitor?.volume ?? 1); if (monitoredMute !== undefined) ref.current.muted = monitoredMute; onDuration?.(ref.current.duration); } },
    onPlay: () => { blockedRef.current = null; setBlockedSource(null); },
    onEnded: () => { if (block.loop && ref.current) { ref.current.currentTime = block.trimStart; void ref.current.play().catch(() => { blockedRef.current = block.src; setBlockedSource(block.src); }); } else onComplete?.(); },
    onTimeUpdate: () => {
      const element = ref.current;
      if (element && block.trimEnd !== null && element.currentTime >= block.trimEnd) {
        if (block.loop) element.currentTime = block.trimStart;
        else { element.pause(); onComplete?.(); }
      }
    },
    className: `w-full min-w-0 max-w-full rounded-lg ${fit && block.kind === "video" ? "min-h-0 flex-1 object-contain" : ""}`,
  };
  return <div className={fit ? "flex h-full min-h-0 flex-col gap-3 overflow-auto" : "space-y-3"}>{block.kind === "audio" ? <audio ref={(element) => { ref.current = element; }} aria-label={block.name} {...props} /> : <video ref={(element) => { ref.current = element; }} aria-label={block.name} playsInline {...props} />}{blocked && <p role="status" className="text-sm">Press Play on the media player to enable playback.</p>}{block.transcript && <details><summary className="cursor-pointer text-sm font-medium">Transcript</summary><p className="mt-3 whitespace-pre-wrap text-sm leading-7">{block.transcript}</p></details>}</div>;
}
