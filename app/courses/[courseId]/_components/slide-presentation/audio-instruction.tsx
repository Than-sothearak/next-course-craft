"use client";
import { useEffect, useRef, useState } from "react";
import { Pause, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { backgroundPaint, solidColor, textPaint } from "@/lib/color";
import type { ContentBlock } from "@/lib/schemas/block";
import { slideMediaRestartEvent } from "@/lib/editor/slide-playback";
import { useSlidePlaybackActive } from "./slide-playback-context";

export function AudioInstruction({ block, authoring = false, presentation = false, onEnded }: { block: Extract<ContentBlock, { type: "audioInstruction" }>; authoring?: boolean; presentation?: boolean; onEnded?: () => void }) {
  const { data } = block;
  const active = useSlidePlaybackActive();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    let cancelled = false;
    const play = () => {
      try { void audio.play()?.then(() => { if (cancelled || (!active && !authoring)) audio.pause(); }).catch(() => { if (!cancelled) setPlaying(false); }); }
      catch { if (!cancelled) setPlaying(false); }
    };
    const restart = () => { if ((!active && !authoring) || !data.src) return; audio.currentTime = 0; play(); };
    audio.addEventListener(slideMediaRestartEvent, restart);
    if (active && !authoring && data.autoPlay && data.src) play();
    if (!active && !authoring && !audio.paused) audio.pause();
    return () => { cancelled = true; audio.removeEventListener(slideMediaRestartEvent, restart); if (!audio.paused) audio.pause(); };
  }, [active, authoring, data.autoPlay, data.src]);
  function toggle() {
    const audio = audioRef.current;
    if (!audio || (!active && !authoring)) return;
    if (!audio.paused) audio.pause();
    else { try { void audio.play()?.catch(() => setPlaying(false)); } catch { setPlaying(false); } }
  }
  return <div data-audio-instruction={block.id} className="flex h-full min-h-10 w-full items-center justify-center" style={{ height: presentation ? undefined : 40 }}>
    <audio ref={audioRef} src={data.src || undefined} data-slide-media-player={block.id} data-audio-instruction-media preload="none" aria-label={data.label} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => { setPlaying(false); if (active && !authoring) onEnded?.(); }} onError={() => setPlaying(false)} />
    {(data.showIcon || data.showText) && <Button variant="default" size={data.showText ? "sm" : "icon"} disabled={!data.src} aria-label={`${playing ? "Pause" : "Play"} ${data.label}`} aria-pressed={playing} onClick={toggle} className="max-w-full gap-2 overflow-hidden" style={{ ...backgroundPaint(data.color), color: solidColor(data.textColor), borderRadius: block.slideBorderRadius ?? 12 }}>
      {data.showIcon && (playing ? <Pause size={20} aria-hidden="true" className="shrink-0" /> : <Volume2 size={20} aria-hidden="true" className="shrink-0" />)}
      {data.showText && <span className="truncate" style={textPaint(data.textColor)}>{data.label}</span>}
    </Button>}
  </div>;
}
