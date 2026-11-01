"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Pause, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { backgroundPaint, solidColor, textPaint } from "@/lib/color";
import type { ContentBlock } from "@/lib/schemas/block";
import { slideMediaRestartEvent } from "@/lib/editor/slide-playback";
import { useSlidePlaybackActive } from "./slide-playback-context";
import type { AudioInstructionGuide as Guide } from "@/lib/editor/audio-instruction-guide";
import { AudioInstructionGuide } from "./audio-instruction-guide";
import { useAudioGuideTiming } from "./use-audio-guide-timing";

export function AudioInstruction({ block, authoring = false, presentation = false, guideEditing = false, onGuideChange, onEnded }: { block: Extract<ContentBlock, { type: "audioInstruction" }>; authoring?: boolean; presentation?: boolean; guideEditing?: boolean; onGuideChange?: (change: Partial<Guide>) => void; onEnded?: () => void }) {
  const { data } = block;
  const active = useSlidePlaybackActive();
  const audioRef = useRef<HTMLAudioElement>(null), generation = useRef(0), latestPlay = useRef(0), pendingPauseEvents = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [canvas, setCanvas] = useState<HTMLElement | null>(null);
  const guide = useAudioGuideTiming(presentation ? data.guide : undefined, data.src, active, authoring);
  const stopAudio = useCallback((audio: HTMLAudioElement) => {
    if (audio.paused) return;
    // Native pause events are queued; an old pause must not cancel a new guide sequence.
    pendingPauseEvents.current++;
    generation.current++;
    setPlaying(false);
    audio.pause();
  }, []);
  useLayoutEffect(() => {
    if (presentation && data.guide?.enabled) setCanvas(audioRef.current?.closest<HTMLElement>("[data-slide-canvas]") ?? null);
  }, [presentation, data.guide?.enabled]);
  const play = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || (!active && !authoring)) return;
    const current = ++generation.current;
    latestPlay.current = current;
    const failed = () => { if (current === generation.current) { setPlaying(false); guide.failed(); } };
    try {
      void audio.play()?.then(() => { if (audioRef.current !== audio || (current !== generation.current && latestPlay.current === current)) stopAudio(audio); }).catch(failed);
    } catch { failed(); }
  }, [active, authoring, guide.failed, stopAudio]);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const restart = () => { if ((!active && !authoring) || !data.src) return; stopAudio(audio); audio.currentTime = 0; guide.requestPlay(play, true); };
    audio.addEventListener(slideMediaRestartEvent, restart);
    if (active && !authoring && data.autoPlay && data.src) guide.requestPlay(play);
    if (!active && !authoring) stopAudio(audio);
    return () => { generation.current++; audio.removeEventListener(slideMediaRestartEvent, restart); stopAudio(audio); };
  }, [active, authoring, data.autoPlay, data.src, guide.requestPlay, play, stopAudio]);
  function toggle() {
    const audio = audioRef.current;
    if (!audio || (!active && !authoring)) return;
    if (guide.starting) { guide.pause(); return; }
    if (!audio.paused) audio.pause();
    else guide.requestPlay(play);
  }
  const engaged = playing || guide.starting;
  return <div data-audio-instruction={block.id} className="flex h-full min-h-10 w-full items-center justify-center" style={{ height: presentation ? undefined : 40 }}>
      <audio ref={audioRef} src={data.src || undefined} data-slide-media-player={block.id} data-audio-instruction-media preload="none" aria-label={data.label} onPlay={() => setPlaying(true)} onPlaying={() => { setPlaying(true); guide.playing(); }} onPause={() => { if (pendingPauseEvents.current) { pendingPauseEvents.current--; return; } generation.current++; setPlaying(false); guide.pause(); }} onEnded={() => { generation.current++; setPlaying(false); guide.ended(); if (active && !authoring) onEnded?.(); }} onError={() => { generation.current++; setPlaying(false); guide.error(); }} />
    {(data.showIcon || data.showText) && <Button variant="default" size={data.showText ? "sm" : "icon"} disabled={!data.src} aria-label={`${engaged ? "Pause" : "Play"} ${data.label}`} aria-pressed={engaged} onClick={toggle} className="max-w-full gap-2 overflow-hidden" style={{ ...backgroundPaint(data.color), color: solidColor(data.textColor), borderRadius: block.slideBorderRadius ?? 12 }}>
      {data.showIcon && (engaged ? <Pause size={20} aria-hidden="true" className="shrink-0" /> : <Volume2 size={20} aria-hidden="true" className="shrink-0" />)}
      {data.showText && <span className="truncate" style={textPaint(data.textColor)}>{data.label}</span>}
    </Button>}
    {canvas && data.guide?.enabled && (guideEditing || (!authoring && active && guide.visible && data.src)) && <AudioInstructionGuide id={block.id} canvas={canvas} guide={data.guide} open={guideEditing || guide.open} editing={guideEditing} onOpen={guide.reopen} onClose={guide.close} onChange={onGuideChange} />}
  </div>;
}
