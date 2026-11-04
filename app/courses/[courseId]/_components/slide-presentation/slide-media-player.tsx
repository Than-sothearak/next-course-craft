"use client";

import { useEffect, useEffectEvent, useRef, useState, type Ref, type SyntheticEvent } from "react";
import { Captions, Music2, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ContentBlock } from "@/lib/schemas/block";
import { slideMediaRestartEvent } from "@/lib/editor/slide-playback";
import { useSlidePlaybackActive, useSlideProgressReady } from "./slide-playback-context";
import { croppedMediaStyle, cropViewportStyle, resolveSlideCrop } from "@/lib/editor/slide-crop";
import { resolveSlideMedia } from "@/lib/editor/slide-objects";
import { defaultSlideAudioSize, slideAudioSizes } from "@/lib/editor/slide-audio";
import { SlideColorOverlay } from "./slide-color-overlay";
import { useRequiredMediaPlayback } from "@/components/use-required-media-playback";
import type { MediaPlaybackProgress as PlaybackProgress } from "@/lib/export/media-playback";

export function SlideMediaPlayer({ block, onDimensions, onDurationChange, onEnded, decorative = false, requireFullPlayback = false, trackProgress = false, completed = false, initialProgress, onProgress }: {
  block: Extract<ContentBlock, { type: "video" | "audio" }>;
  onDimensions?: (dimensions: { width: number; height: number }) => void;
  onDurationChange?: (duration: number | null) => void;
  onEnded?: () => void;
  decorative?: boolean;
  requireFullPlayback?: boolean;
  trackProgress?: boolean;
  completed?: boolean;
  initialProgress?: PlaybackProgress;
  onProgress?: (progress: PlaybackProgress) => void;
}) {
  const slideActive = useSlidePlaybackActive();
  const progressReady = useSlideProgressReady();
  const active = slideActive && !decorative && (block.type !== "video" || progressReady);
  const { events: playback } = useRequiredMediaPlayback(block.data.src, requireFullPlayback, onEnded, active, { enabled: trackProgress && !decorative, completed, initial: initialProgress, onProgress });
  const mediaRef = useRef<HTMLMediaElement>(null);
  const trackRef = useRef<HTMLTrackElement>(null);
  const pointerFocus = useRef(false);
  const videoVisit = useRef({ source: block.data.src, entered: false, active: false, left: false, resetOnMetadata: false });
  const readVideoSettings = useEffectEvent(() => ({ completed, revisitBehavior: block.slidePlayback?.revisitBehavior ?? "restart" }));
  const reportCachedDuration = useEffectEvent((media: HTMLMediaElement) => {
    // Metadata can arrive before hydration attaches React's media listeners.
    if (media.readyState >= 1) reportDuration(media);
  });
  const [playing, setPlaying] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [keyboardFocused, setKeyboardFocused] = useState(false);
  const [touchControls, setTouchControls] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const configuredMuted = block.slidePlayback?.muted ?? false;
  const [muteOverride, setMuteOverride] = useState<{ configured: boolean; value: boolean } | null>(null);
  const muted = muteOverride?.configured === configuredMuted ? muteOverride.value : configuredMuted;
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [caption, setCaption] = useState("");
  const crop = block.type === "video" ? resolveSlideCrop(block) : undefined;
  const dimensions = resolveSlideMedia(block);
  const cropped = Boolean(crop);
  const captionSource = block.type === "video" ? block.data.captions : undefined;
  const autoPlay = block.slidePlayback?.autoPlay ?? false;
  const loop = block.slidePlayback?.loop ?? false;
  const controlsEnabled = block.slidePlayback?.showControls ?? true;
  const controlsVisible = block.type === "audio" || hovered || keyboardFocused || touchControls;
  const controls = controlsEnabled && controlsVisible;
  const label = block.type === "audio" ? block.data.fileName || "Slide audio" : "Slide video";
  const audioSizeName = block.type === "audio" ? block.slidePlayback?.audioSize ?? defaultSlideAudioSize : undefined;
  const audioSize = audioSizeName ? slideAudioSizes[audioSizeName] : undefined;

  useEffect(() => {
    const element = trackRef.current;
    if (!cropped || !element?.track) return;
    const update = () => setCaption(Array.from(element.track.activeCues ?? []).map((cue) => "text" in cue ? String(cue.text) : "").join("\n"));
    element.track.mode = "hidden";
    element.addEventListener("cuechange", update);
    return () => { element.removeEventListener("cuechange", update); element.track.mode = "disabled"; };
  }, [cropped, captionSource]);

  useEffect(() => {
    if (decorative) return;
    const media = mediaRef.current;
    if (!media) return;
    reportCachedDuration(media);
    let cancelled = false;
    const play = () => {
      const promise = media.play();
      void promise?.then(() => { if ((cancelled || !active) && !media.paused) media.pause(); }).catch(() => { if (!cancelled && active) setPlaying(false); });
    };
    const restart = () => {
      if (!active) return;
      videoVisit.current.resetOnMetadata = block.type === "video" && media.readyState === 0;
      media.currentTime = 0;
      play();
    };
    media.addEventListener(slideMediaRestartEvent, restart);
    let allowAutoplay = true;
    if (block.type === "video") {
      if (videoVisit.current.source !== block.data.src) videoVisit.current = { source: block.data.src, entered: false, active: false, left: false, resetOnMetadata: false };
      const visit = videoVisit.current;
      const settings = readVideoSettings();
      if (active && !visit.active) {
        if (visit.entered && settings.revisitBehavior === "restart") {
          // Rewind only the playhead; the progress guard keeps verified viewing.
          visit.resetOnMetadata = media.readyState === 0;
          media.currentTime = 0;
        }
        visit.entered = true;
      }
      if (!active && visit.entered) visit.left = true;
      visit.active = active;
      allowAutoplay = !visit.left && !settings.completed;
    }
    if (active && autoPlay && allowAutoplay && block.data.src) play();
    if (!active && !media.paused) media.pause();
    return () => {
      cancelled = true;
      media.removeEventListener(slideMediaRestartEvent, restart);
      if (!media.paused) media.pause();
    };
  }, [active, autoPlay, block.data.src, block.type, decorative]);

  function togglePlayback() {
    const media = mediaRef.current;
    if (!media || !active) return;
    if (!media.paused) media.pause();
    else void media.play()?.catch(() => setPlaying(false));
  }
  function metadata(event: SyntheticEvent<HTMLMediaElement>) {
    playback.onLoadedMetadata(event);
    const media = event.currentTarget;
    if (active && block.type === "video" && videoVisit.current.resetOnMetadata) {
      videoVisit.current.resetOnMetadata = false;
      media.currentTime = 0;
    }
    if (crop) setTime(media.currentTime);
    if (crop) setDuration(Number.isFinite(media.duration) ? media.duration : 0);
    reportDuration(media);
    if (media instanceof HTMLVideoElement && media.videoWidth && media.videoHeight) onDimensions?.({ width: media.videoWidth, height: media.videoHeight });
  }
  function reportDuration(media: HTMLMediaElement) {
    onDurationChange?.(
      Number.isFinite(media.duration) && media.duration > 0
        ? media.duration
        : null,
    );
  }
  function end(event: SyntheticEvent<HTMLMediaElement>) {
    if (!active) return;
    setPlaying(false);
    const completed = playback.onEnded(event);
    // The first pass needs an ended event; subsequent passes keep the authored loop.
    if (completed && requireFullPlayback && loop) void event.currentTarget.play()?.catch(() => setPlaying(false));
  }
  const common = {
    "data-slide-media-player": decorative ? undefined : block.id,
    controls: !crop && controls, autoPlay: block.type !== "video" && active && autoPlay && Boolean(block.data.src), loop: loop && !requireFullPlayback, preload: decorative ? "none" as const : "metadata" as const,
    muted: decorative || muted,
    src: block.data.src || undefined, onEnded: end, onLoadedMetadata: metadata,
    onSeeking: playback.onSeeking, onSeeked: playback.onSeeked,
    onPlay: () => setPlaying(true), onPause: () => setPlaying(false),
    onTimeUpdate: (event: SyntheticEvent<HTMLMediaElement>) => { playback.onTimeUpdate(event); if (crop) setTime(event.currentTarget.currentTime); },
    onDurationChange: (event: SyntheticEvent<HTMLMediaElement>) => {
      const media = event.currentTarget;
      if (crop) setDuration(Number.isFinite(media.duration) ? media.duration : 0);
      reportDuration(media);
    },
    "aria-label": label,
  };
  return <div data-slide-audio-content={block.type === "audio" || undefined} data-slide-audio-size={audioSizeName} className={`relative flex ${block.type === "audio" ? "h-auto" : "h-full"} w-full flex-col justify-center gap-3 ${crop ? "items-center" : ""}`} style={audioSize ? { gap: audioSize.gap } : crop ? { containerType: "size" } : undefined} data-slide-playback-controls={controls ? "visible" : "hidden"}
    onPointerEnter={(event) => { if (block.type === "video" && event.pointerType !== "touch") setHovered(true); }}
    onPointerLeave={(event) => { if (block.type === "video" && event.pointerType !== "touch") setHovered(false); }}
    onPointerDownCapture={(event) => {
      if (block.type !== "video") return;
      pointerFocus.current = true;
      setKeyboardFocused(false);
      if (event.pointerType === "touch") setTouchControls(true);
    }}
    onFocusCapture={() => { if (block.type === "video" && !pointerFocus.current) setKeyboardFocused(true); }}
    onBlurCapture={(event) => {
      if (event.currentTarget.contains(event.relatedTarget)) return;
      pointerFocus.current = false;
      setKeyboardFocused(false);
      setTouchControls(false);
    }}
    onKeyDownCapture={() => { if (block.type === "video") { pointerFocus.current = false; setKeyboardFocused(true); } }}
  >
    {block.type === "audio" && (block.slidePlayback?.showFileName ?? false) && <div data-slide-audio-title className="flex min-w-0 items-center gap-2 text-sm" style={{ fontSize: audioSizeName === "small" ? 12 : undefined }}><Music2 size={audioSize?.icon} className="shrink-0" /><span className="min-w-0 break-words">{label}</span></div>}
    {block.type === "video" ? <div className="relative h-full w-full overflow-hidden" style={crop && dimensions ? cropViewportStyle(dimensions, crop) : undefined} data-slide-media-crop={crop ? true : undefined}><video {...common} ref={mediaRef as Ref<HTMLVideoElement>} tabIndex={0} playsInline style={crop ? croppedMediaStyle(crop) : undefined} className="h-full w-full object-contain">
      {block.data.captions && <track ref={trackRef} kind="captions" src={block.data.captions} srcLang="en" label="Captions" />}
    </video>{block.slideMediaOverlay && <SlideColorOverlay {...block.slideMediaOverlay} />}</div> : <audio {...common} ref={mediaRef as Ref<HTMLAudioElement>} className="w-full shrink-0" style={{ height: audioSize?.height, display: controlsEnabled ? undefined : "none" }} />}
    {crop && captionsEnabled && caption && <p data-cropped-video-caption className={`pointer-events-none absolute inset-x-3 whitespace-pre-line text-center text-sm text-white ${controls ? "bottom-12" : "bottom-3"}`}><span className="bg-black/80 px-1">{caption}</span></p>}
    {crop && controls && <div data-cropped-video-controls className="absolute inset-x-2 bottom-2 flex min-w-0 items-center gap-1 rounded-md bg-slate-950/85 p-1 text-white">
      <Button variant="ghost" size="icon" className="size-7 shrink-0 text-white hover:bg-white/20 hover:text-white" aria-label={playing ? "Pause video" : "Play video"} onClick={togglePlayback}>{playing ? <Pause size={14} /> : <Play size={14} />}</Button>
      <Input type="range" aria-label="Video playback position" min={0} max={duration || 1} step={0.1} value={Math.min(time, duration)} disabled={!duration || !active} onChange={(event) => { const media = mediaRef.current; if (!media) return; media.currentTime = event.target.valueAsNumber; playback.onSeeking({ currentTarget: media }); setTime(media.currentTime); }} className="h-5 min-w-0 flex-1 border-0 bg-transparent p-0 accent-indigo-400 shadow-none" />
      <Button variant="ghost" size="icon" className="size-7 shrink-0 text-white hover:bg-white/20 hover:text-white" aria-label={muted ? "Unmute video" : "Mute video"} onClick={() => { if (mediaRef.current) { mediaRef.current.muted = !mediaRef.current.muted; setMuteOverride({ configured: configuredMuted, value: mediaRef.current.muted }); } }}>{muted ? <VolumeX size={14} /> : <Volume2 size={14} />}</Button>
      {block.type === "video" && block.data.captions && <Button variant="ghost" size="icon" className="size-7 shrink-0 text-white hover:bg-white/20 hover:text-white" aria-label={captionsEnabled ? "Hide video captions" : "Show video captions"} aria-pressed={captionsEnabled} onClick={() => setCaptionsEnabled(!captionsEnabled)}><Captions size={14} /></Button>}
    </div>}
    {!controlsEnabled && controlsVisible && <Button type="button" variant="outline" size="icon" aria-label={`${playing ? "Pause" : "Play"} ${block.type}`} title={`${playing ? "Pause" : "Play"} ${block.type}`} onClick={togglePlayback} style={audioSize ? { width: audioSize.button, height: audioSize.button } : undefined} className={block.type === "video" ? "absolute bottom-3 left-3 border-0 bg-transparent text-white shadow-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] hover:bg-transparent" : "bg-white text-slate-900"}>
      {playing ? <Pause size={18} /> : <Play size={18} />}
    </Button>}
  </div>;
}
