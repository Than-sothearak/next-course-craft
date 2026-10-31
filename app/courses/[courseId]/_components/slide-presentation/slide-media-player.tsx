"use client";

import { useEffect, useRef, useState, type Ref, type SyntheticEvent } from "react";
import { Captions, Music2, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ContentBlock } from "@/lib/schemas/block";
import { slideMediaRestartEvent } from "@/lib/editor/slide-playback";
import { useSlidePlaybackActive } from "./slide-playback-context";
import { croppedMediaStyle, cropViewportStyle, resolveSlideCrop } from "@/lib/editor/slide-crop";
import { resolveSlideMedia } from "@/lib/editor/slide-objects";

export function SlideMediaPlayer({ block, onDimensions, onEnded }: {
  block: Extract<ContentBlock, { type: "video" | "audio" }>;
  onDimensions?: (dimensions: { width: number; height: number }) => void;
  onEnded?: () => void;
}) {
  const active = useSlidePlaybackActive();
  const mediaRef = useRef<HTMLMediaElement>(null);
  const trackRef = useRef<HTMLTrackElement>(null);
  const pointerFocus = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [keyboardFocused, setKeyboardFocused] = useState(false);
  const [touchControls, setTouchControls] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [caption, setCaption] = useState("");
  const crop = block.type === "video" ? resolveSlideCrop(block) : undefined;
  const dimensions = resolveSlideMedia(block);
  const cropped = Boolean(crop);
  const captionSource = block.type === "video" ? block.data.captions : undefined;
  const autoPlay = block.slidePlayback?.autoPlay ?? false;
  const controlsEnabled = block.slidePlayback?.showControls ?? true;
  const controlsVisible = block.type === "audio" || hovered || keyboardFocused || touchControls;
  const controls = controlsEnabled && controlsVisible;
  const label = block.type === "audio" ? block.data.fileName || "Slide audio" : "Slide video";

  useEffect(() => {
    const element = trackRef.current;
    if (!cropped || !element?.track) return;
    const update = () => setCaption(Array.from(element.track.activeCues ?? []).map((cue) => "text" in cue ? String(cue.text) : "").join("\n"));
    element.track.mode = "hidden";
    element.addEventListener("cuechange", update);
    return () => { element.removeEventListener("cuechange", update); element.track.mode = "disabled"; };
  }, [cropped, captionSource]);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;
    let cancelled = false;
    const play = () => {
      const promise = media.play();
      void promise?.then(() => { if ((cancelled || !active) && !media.paused) media.pause(); }).catch(() => { if (!cancelled && active) setPlaying(false); });
    };
    const restart = () => {
      if (!active) return;
      media.currentTime = 0;
      play();
    };
    media.addEventListener(slideMediaRestartEvent, restart);
    if (active && autoPlay && block.data.src) play();
    if (!active && !media.paused) media.pause();
    return () => {
      cancelled = true;
      media.removeEventListener(slideMediaRestartEvent, restart);
      if (!media.paused) media.pause();
    };
  }, [active, autoPlay, block.data.src]);

  function togglePlayback() {
    const media = mediaRef.current;
    if (!media || !active) return;
    if (!media.paused) media.pause();
    else void media.play()?.catch(() => setPlaying(false));
  }
  function metadata(event: SyntheticEvent<HTMLMediaElement>) {
    const media = event.currentTarget;
    if (crop) setDuration(Number.isFinite(media.duration) ? media.duration : 0);
    if (media instanceof HTMLVideoElement && media.videoWidth && media.videoHeight) onDimensions?.({ width: media.videoWidth, height: media.videoHeight });
  }
  function end() {
    if (!active) return;
    setPlaying(false);
    onEnded?.();
  }
  const common = {
    "data-slide-media-player": block.id,
    controls: !crop && controls, autoPlay: active && autoPlay && Boolean(block.data.src), preload: "metadata" as const,
    src: block.data.src || undefined, onEnded: end, onLoadedMetadata: metadata,
    onPlay: () => setPlaying(true), onPause: () => setPlaying(false),
    onTimeUpdate: () => { if (crop && mediaRef.current) setTime(mediaRef.current.currentTime); },
    onDurationChange: () => { const value = mediaRef.current?.duration; if (crop && value !== undefined) setDuration(Number.isFinite(value) ? value : 0); },
    "aria-label": label,
  };
  return <div className={`relative flex h-full w-full flex-col justify-center gap-3 ${crop ? "items-center" : ""}`} style={crop ? { containerType: "size" } : undefined} data-slide-playback-controls={controls ? "visible" : "hidden"}
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
    {block.type === "audio" && (block.slidePlayback?.showFileName ?? true) && <div className="flex min-w-0 items-center gap-2 text-sm"><Music2 size={22} className="shrink-0" /><span className="min-w-0 break-words">{label}</span></div>}
    {block.type === "video" ? <div className="relative h-full w-full overflow-hidden" style={crop && dimensions ? cropViewportStyle(dimensions, crop) : undefined} data-slide-media-crop={crop ? true : undefined}><video {...common} ref={mediaRef as Ref<HTMLVideoElement>} tabIndex={0} playsInline style={crop ? croppedMediaStyle(crop) : undefined} className="h-full w-full object-contain">
      {block.data.captions && <track ref={trackRef} kind="captions" src={block.data.captions} srcLang="en" label="Captions" />}
    </video></div> : <audio {...common} ref={mediaRef as Ref<HTMLAudioElement>} className="w-full" />}
    {crop && captionsEnabled && caption && <p data-cropped-video-caption className={`pointer-events-none absolute inset-x-3 whitespace-pre-line text-center text-sm text-white ${controls ? "bottom-12" : "bottom-3"}`}><span className="bg-black/80 px-1">{caption}</span></p>}
    {crop && controls && <div data-cropped-video-controls className="absolute inset-x-2 bottom-2 flex min-w-0 items-center gap-1 rounded-md bg-slate-950/85 p-1 text-white">
      <Button variant="ghost" size="icon" className="size-7 shrink-0 text-white hover:bg-white/20 hover:text-white" aria-label={playing ? "Pause video" : "Play video"} onClick={togglePlayback}>{playing ? <Pause size={14} /> : <Play size={14} />}</Button>
      <Input type="range" aria-label="Video playback position" min={0} max={duration || 1} step={0.1} value={Math.min(time, duration)} disabled={!duration || !active} onChange={(event) => { if (mediaRef.current) mediaRef.current.currentTime = event.target.valueAsNumber; setTime(event.target.valueAsNumber); }} className="h-5 min-w-0 flex-1 border-0 bg-transparent p-0 accent-indigo-400 shadow-none" />
      <Button variant="ghost" size="icon" className="size-7 shrink-0 text-white hover:bg-white/20 hover:text-white" aria-label={muted ? "Unmute video" : "Mute video"} onClick={() => { if (mediaRef.current) { mediaRef.current.muted = !mediaRef.current.muted; setMuted(mediaRef.current.muted); } }}>{muted ? <VolumeX size={14} /> : <Volume2 size={14} />}</Button>
      {block.type === "video" && block.data.captions && <Button variant="ghost" size="icon" className="size-7 shrink-0 text-white hover:bg-white/20 hover:text-white" aria-label={captionsEnabled ? "Hide video captions" : "Show video captions"} aria-pressed={captionsEnabled} onClick={() => setCaptionsEnabled(!captionsEnabled)}><Captions size={14} /></Button>}
    </div>}
    {!controlsEnabled && controlsVisible && <Button type="button" variant="outline" size="icon" aria-label={`${playing ? "Pause" : "Play"} ${block.type}`} title={`${playing ? "Pause" : "Play"} ${block.type}`} onClick={togglePlayback} className={block.type === "video" ? "absolute bottom-3 left-3 border-0 bg-transparent text-white shadow-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] hover:bg-transparent" : "bg-white text-slate-900"}>
      {playing ? <Pause size={18} /> : <Play size={18} />}
    </Button>}
  </div>;
}
