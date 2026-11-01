"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Volume2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SlideNavigationGuide } from "@/lib/editor/slide-design";
import { guidanceStorageKey, guidanceWasSeen, rememberGuidance } from "@/lib/editor/slide-guidance";

export function usePresentationGuidance({ courseId, standalone, guide, selectedId, coverVisible, menuOpen, audioEnabled }: { courseId: string; standalone: boolean; guide?: SlideNavigationGuide; selectedId: string | null; coverVisible: boolean; menuOpen: boolean; audioEnabled: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [source, setSource] = useState("");
  const [playing, setPlaying] = useState(false);
  const [guideStep, setGuideStep] = useState<number | null>(null);
  const startedGuide = useRef("");
  const guideKey = guidanceStorageKey(courseId, "navigation", standalone);
  const playAudio = useCallback((src: string) => {
    const audio = audioRef.current;
    if (!audio || !src) return;
    setSource(src);
    if (audio.getAttribute("src") !== src) audio.setAttribute("src", src);
    audio.currentTime = 0;
    try { void audio.play()?.then(() => setPlaying(true)).catch(() => setPlaying(false)); }
    catch { setPlaying(false); }
  }, []);
  const pauseAudio = useCallback(() => { audioRef.current?.pause(); setPlaying(false); }, []);
  useEffect(() => { const audio = audioRef.current; return () => { if (audio?.getAttribute("src")) audio.pause(); }; }, [audioEnabled]);
  useEffect(() => {
    if (!guide?.enabled || !selectedId || coverVisible || menuOpen || startedGuide.current === guideKey) return;
    const frame = window.requestAnimationFrame(() => {
      startedGuide.current = guideKey;
      if (!guide.firstVisitOnly || !guidanceWasSeen(guideKey)) setGuideStep(0);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [guide, guideKey, selectedId, coverVisible, menuOpen]);
  const changeGuideStep = (step: number | null) => { startedGuide.current = guideKey; setGuideStep(step); if (step === null && guide?.firstVisitOnly) rememberGuidance(guideKey); };
  // Assign src only in playAudio: setting it again during React's commit resets
  // the pending user-initiated playback when Start also changes the active slide.
  const audioElement = audioEnabled ? <audio ref={audioRef} data-presentation-instruction-audio preload="none" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onError={() => setPlaying(false)} /> : null;
  const audioControl = source ? <div className="absolute left-3 z-30 flex items-center gap-1 rounded-lg bg-white/95 p-1 text-slate-700 shadow-sm" style={{ bottom: "calc(var(--slide-footer-height, 64px) + 16px)" }}>
    <Button variant="ghost" size="sm" className="min-h-7 gap-1.5 px-2 text-xs" aria-label={playing ? "Pause instructions" : "Play instructions"} onClick={() => { if (playing) { audioRef.current?.pause(); setPlaying(false); } else playAudio(source); }}>{playing ? <Pause size={14} aria-hidden="true" /> : <Volume2 size={14} aria-hidden="true" />}Instructions</Button>
    <Button variant="ghost" size="icon" className="size-6" aria-label="Close instruction audio" onClick={() => { audioRef.current?.pause(); audioRef.current?.removeAttribute("src"); setPlaying(false); setSource(""); }}><X size={12} aria-hidden="true" /></Button>
  </div> : null;
  return { playAudio, pauseAudio, source, playing, audioElement, audioControl, guideStep, changeGuideStep };
}
