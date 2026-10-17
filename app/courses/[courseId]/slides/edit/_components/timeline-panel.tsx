"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import { ChevronFirst, ChevronLast, Expand, Maximize2, Magnet, Minus, Music, Pause, Play, Plus, Repeat2, RotateCcw, SkipBack, SkipForward, Square, Sun, Moon, Video, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SlideMaster } from "@/lib/slides/master-schema";
import type { LearningBlock, LearningPage } from "@/lib/slides/blocks";
import { defaultAudioMonitor, formatTimelineTime, minimumPreviewWorkspace, minimumTimelineHeight, moveTimelineLayer, scheduleTimelineLayer, resetTimelineEnd, snapTimelineMove, snapTimelineTime, timelinePanelHeight, timelinePixelsToTime, timelineSnapPoints, timelineTickStep, timelineTimeToPixels, trimTimelineLayer, type PreviewAudioMonitor } from "@/lib/slides/timeline";
import { useTimelinePreferences } from "./use-timeline-preferences";
import { TimelineTrack, type ClipGesture, type ClipAdjustment } from "./timeline-track";

type Props = {
  preferenceKey?: string; page: LearningPage; master?: SlideMaster; selectedId?: string; disabled: boolean; time: number; playing: boolean;
  height: number; workspaceRef: RefObject<HTMLDivElement | null>; onHeight: (height: number) => void;
  onSelect: (id: string) => void; onPlay: () => void; onRestart: () => void; onSeek: (time: number) => void;
  onDuration: (duration: number) => void; onTrim: () => void; onAddMedia: (kind: "audio" | "video") => void;
  onLayer: (id: string, update: (layer: LearningBlock) => LearningBlock, group?: string) => void;
  onLayerPreview?: (block: LearningBlock | null) => void;
  monitor?: PreviewAudioMonitor; onMonitor?: (monitor: PreviewAudioMonitor) => void;
  loop?: boolean; onLoop?: () => void;
};
type TrackDrag = { pointerId: number; block: LearningBlock; mode: ClipGesture; x: number; scrollLeft: number; pixelsPerSecond: number; group: string; final: LearningBlock };
const controlClass = "size-8 text-inherit hover:bg-slate-500/20 hover:text-inherit focus-visible:ring-indigo-400 focus-visible:ring-offset-0";

export function PageTimeline(props: Props) {
  const { page, master, selectedId, disabled, time, playing, height, workspaceRef, onHeight, onPlay, onRestart, onSeek, onDuration, onAddMedia, loop, onLoop } = props;
  const latest = useRef(props);
  useEffect(() => { latest.current = props; });
  const scrollRef = useRef<HTMLDivElement>(null), resizeRef = useRef<{ pointerId: number; y: number; height: number } | null>(null);
  const dragRef = useRef<TrackDrag | null>(null), seekRef = useRef<number | null>(null), columnRef = useRef<{ x: number; width: number } | null>(null);
  const zoomAnchor = useRef<number | null>(null);
  const [workspaceHeight, setWorkspaceHeight] = useState(800), [viewportWidth, setViewportWidth] = useState(960);
  const preferences = useTimelinePreferences(props.preferenceKey ?? "coursecraft:timeline:workspace");
  const { zoom, snapping, dark, nameWidth } = preferences.value;
  const [maximized, setMaximized] = useState(false);
  const setZoom = (value: number) => preferences.update({ zoom: value });
  const setSnapping = (update: (value: boolean) => boolean) => preferences.update({ snapping: update(snapping) });
  const setDark = (update: (value: boolean) => boolean) => preferences.update({ dark: update(dark) });
  const setNameWidth = (update: number | ((value: number) => number)) => preferences.update({ nameWidth: typeof update === "function" ? update(nameWidth) : update });
  const [preview, setPreview] = useState<LearningBlock | null>(null), [localMonitor, setLocalMonitor] = useState(defaultAudioMonitor);
  const audio = props.monitor ?? localMonitor;
  const baseWidth = Math.max(240, viewportWidth - nameWidth - 192), trackWidth = baseWidth * zoom, pixelsPerSecond = trackWidth / page.duration;
  const scaleRef = useRef({ pixelsPerSecond, snapping, nameWidth });
  useEffect(() => { scaleRef.current = { pixelsPerSecond, snapping, nameWidth }; }, [pixelsPerSecond, snapping, nameWidth]);
  useEffect(() => {
    const workspace = workspaceRef.current, viewport = scrollRef.current;
    if (!workspace || !viewport) return;
    const measure = () => { setWorkspaceHeight(workspace.getBoundingClientRect().height || 800); setViewportWidth(viewport.clientWidth || 960); };
    measure(); if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure); observer.observe(workspace); observer.observe(viewport); return () => observer.disconnect();
  }, [workspaceRef, maximized]);
  useEffect(() => {
    if (zoomAnchor.current !== null && scrollRef.current) { scrollRef.current.scrollLeft = Math.max(0, timelineTimeToPixels(zoomAnchor.current, pixelsPerSecond) - scrollRef.current.clientWidth / 2 + nameWidth); zoomAnchor.current = null; }
  }, [pixelsPerSecond, nameWidth]);
  useEffect(() => () => latest.current.onLayerPreview?.(null), []);
  const actualHeight = maximized ? Math.max(minimumTimelineHeight, workspaceHeight - 96) : timelinePanelHeight(height, workspaceHeight);
  function resize(value: number) { onHeight(timelinePanelHeight(value, workspaceRef.current?.getBoundingClientRect().height || workspaceHeight)); }
  function changeZoom(value: number) { if (dragRef.current) return; const viewport = scrollRef.current; zoomAnchor.current = viewport ? timelinePixelsToTime(viewport.scrollLeft + viewport.clientWidth / 2 - nameWidth, pixelsPerSecond) : 0; setZoom(Math.max(1, Math.min(16, value))); }

  const cancel = useCallback(() => { dragRef.current = null; setPreview(null); latest.current.onLayerPreview?.(null); }, []);
  const begin = useCallback((event: PointerEvent<HTMLButtonElement>, block: LearningBlock, mode: ClipGesture) => {
    if (latest.current.disabled || block.locked || event.button !== 0) return;
    const track = event.currentTarget.closest<HTMLElement>("[data-timeline-track]")?.getBoundingClientRect();
    if (!track?.width) return;
    event.preventDefault(); event.stopPropagation(); event.currentTarget.focus({ preventScroll: true }); event.currentTarget.setPointerCapture(event.pointerId);
    latest.current.onSelect(block.id); latest.current.onTrim();
    dragRef.current = { pointerId: event.pointerId, block, mode, x: event.clientX, scrollLeft: scrollRef.current?.scrollLeft ?? 0, pixelsPerSecond: track.width / latest.current.page.duration, group: `timeline:${crypto.randomUUID()}`, final: block };
  }, []);
  const drag = useCallback((event: PointerEvent<HTMLButtonElement>) => {
    const gesture = dragRef.current, current = latest.current;
    if (!gesture || event.pointerId !== gesture.pointerId || current.disabled) return;
    const viewport = scrollRef.current;
    if (viewport) { const bounds = viewport.getBoundingClientRect(); if (bounds.width) { if (event.clientX > bounds.right - 180) viewport.scrollLeft += 14; else if (event.clientX < bounds.left + scaleRef.current.nameWidth + 14) viewport.scrollLeft -= 14; } }
    const delta = timelinePixelsToTime(event.clientX - gesture.x + (viewport?.scrollLeft ?? 0) - gesture.scrollLeft, gesture.pixelsPerSecond);
    const { block, mode } = gesture, duration = current.page.duration;
    let requested = (mode === "end" ? block.end ?? duration : block.start) + delta;
    if (scaleRef.current.snapping && !event.altKey) { const points = timelineSnapPoints(current.page.layers, block.id, duration, current.time); requested = mode === "move" ? snapTimelineMove(block, requested, duration, points, gesture.pixelsPerSecond) : snapTimelineTime(requested, points, gesture.pixelsPerSecond); }
    gesture.final = mode === "move" ? moveTimelineLayer(block, requested, duration) : trimTimelineLayer(block, mode, requested, duration);
    setPreview(gesture.final); current.onLayerPreview?.(gesture.final);
  }, []);
  const finish = useCallback(() => {
    const gesture = dragRef.current, current = latest.current;
    if (gesture && !current.disabled && gesture.final !== gesture.block) { const requested = gesture.mode === "end" ? gesture.final.end ?? current.page.duration : gesture.final.start; current.onLayer(gesture.block.id, (block) => gesture.mode === "move" ? moveTimelineLayer(block, requested, current.page.duration) : trimTimelineLayer(block, gesture.mode, requested, current.page.duration), gesture.group); }
    cancel();
  }, [cancel]);
  const select = useCallback((id: string) => latest.current.onSelect(id), []);
  const adjust = useCallback((id: string, mode: ClipAdjustment, value: number | null) => {
    const current = latest.current; if (current.disabled) return; current.onSelect(id); current.onTrim();
    current.onLayer(id, (block) => mode === "schedule" && value !== null ? scheduleTimelineLayer(block, value, current.page.duration) : value === null ? resetTimelineEnd(block, current.page.duration) : mode === "move" ? moveTimelineLayer(block, value, current.page.duration) : trimTimelineLayer(block, mode === "schedule" ? "start" : mode, value, current.page.duration));
  }, []);
  const toggleTrackMonitor = useCallback((id: string, mode: "mute" | "solo") => {
    const current = latest.current, key = mode === "mute" ? "mutedLayerIds" : "soloLayerIds";
    if (current.onMonitor) { const previous = current.monitor ?? defaultAudioMonitor; current.onMonitor({ ...previous, [key]: previous[key].includes(id) ? previous[key].filter((value) => value !== id) : [...previous[key], id] }); }
    else setLocalMonitor((previous) => ({ ...previous, [key]: previous[key].includes(id) ? previous[key].filter((value) => value !== id) : [...previous[key], id] }));
  }, []);
  function changeMonitor(next: PreviewAudioMonitor) { if (props.onMonitor) props.onMonitor(next); else setLocalMonitor(next); }
  function seek(event: PointerEvent<HTMLElement>) { const bounds = event.currentTarget.getBoundingClientRect(); if (bounds.width) onSeek(Math.max(0, Math.min(page.duration, timelinePixelsToTime(event.clientX - bounds.left, bounds.width / page.duration)))); }
  function shortcuts(event: KeyboardEvent<HTMLElement>) {
    const target = event.target as HTMLElement;
    if (dragRef.current && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); event.stopPropagation(); cancel(); return; }
    if (target.closest("input, textarea, select, [contenteditable=true]") || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === "Escape") { cancel(); return; }
    if (target.closest("button")) return;
    const step = event.shiftKey ? 1 : .1;
    if (event.code === "Space") { event.preventDefault(); onPlay(); }
    else if (event.key === "Home") { event.preventDefault(); onRestart(); }
    else if (event.key === "End") { event.preventDefault(); onSeek(page.duration); }
    else if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); onSeek(Math.max(0, Math.min(page.duration, time + (event.key === "ArrowLeft" ? -step : step)))); }
    else if (event.key === "+" || event.key === "=") { event.preventDefault(); changeZoom(zoom * 1.25); }
    else if (event.key === "-") { event.preventDefault(); changeZoom(zoom / 1.25); }
  }
  const tickStep = timelineTickStep(pixelsPerSecond);
  const ticks = useMemo(() => Array.from({ length: Math.floor(page.duration / tickStep) + 1 }, (_, index) => index * tickStep), [page.duration, tickStep]);
  const style = { "--timeline-columns": `${nameWidth}px ${trackWidth}px 72px 72px`, "--timeline-tick": `${timelineTimeToPixels(tickStep / 5, pixelsPerSecond)}px`, "--timeline-playhead": `${timelineTimeToPixels(time, pixelsPerSecond)}px`, "--timeline-bg": dark ? "#151d2b" : "#f8fafc", height: actualHeight, ...(maximized ? { position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 60 } : {}) } as CSSProperties;
  const rows = page.layers.map((block) => preview?.id === block.id ? preview : block);
  return <>
    <Button role="separator" aria-label="Resize timeline" aria-orientation="horizontal" aria-valuemin={minimumTimelineHeight} aria-valuemax={Math.max(minimumTimelineHeight, workspaceHeight - minimumPreviewWorkspace)} aria-valuenow={actualHeight} variant="ghost" className="h-3 min-h-3 w-full shrink-0 cursor-row-resize touch-none rounded-none border-y border-slate-300 bg-slate-200 p-0 hover:bg-indigo-200" title="Drag to resize timeline"
      onPointerDown={(event) => { if (event.button !== 0 || maximized) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); resizeRef.current = { pointerId: event.pointerId, y: event.clientY, height: actualHeight }; }} onPointerMove={(event) => { const gesture = resizeRef.current; if (gesture && gesture.pointerId === event.pointerId) resize(gesture.height + gesture.y - event.clientY); }} onPointerUp={() => { resizeRef.current = null; }} onPointerCancel={() => { resizeRef.current = null; }} onLostPointerCapture={() => { resizeRef.current = null; }} onKeyDown={(event) => { if (maximized) return; if (event.key === "ArrowUp" || event.key === "ArrowDown") { event.preventDefault(); resize(actualHeight + (event.key === "ArrowUp" ? 1 : -1) * (event.shiftKey ? 50 : 20)); } else if (event.key === "Home" || event.key === "End") { event.preventDefault(); resize(event.key === "Home" ? minimumTimelineHeight : workspaceHeight); } }}><span className="h-1 w-10 rounded bg-slate-400" /></Button>
    <section aria-label="Page timeline" data-timeline-panel data-timeline-zoom={zoom} tabIndex={0} onKeyDown={shortcuts} className={`flex shrink-0 flex-col overflow-hidden border-t border-slate-500/30 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400 ${dark ? "bg-[#151d2b] text-slate-200" : "bg-slate-50 text-slate-700"}`} style={style}>
      <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-slate-500/20 px-3 py-2">
        <span className="mr-2 text-[10px] font-semibold tracking-widest opacity-60">TIMELINE</span>
        <Button size="icon" variant="ghost" className={controlClass} aria-label="Go to beginning" title="Go to beginning (Home)" onClick={onRestart}><ChevronFirst size={16} /></Button>
        <Button size="icon" variant="ghost" className={controlClass} aria-label="Step backward" title="Step backward 100 ms" onClick={() => onSeek(Math.max(0, time - .1))}><SkipBack size={15} /></Button>
        <Button size="icon" className="size-8 bg-indigo-500 hover:bg-indigo-400" aria-label={playing ? "Pause timeline" : "Play timeline"} title={playing ? "Pause" : "Play (Space)"} onClick={onPlay}>{playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}</Button>
        <Button size="icon" variant="ghost" className={controlClass} aria-label="Stop timeline" title="Stop" onClick={onRestart}><Square size={13} fill="currentColor" /></Button>
        <Button size="icon" variant="ghost" className={controlClass} aria-label="Step forward" title="Step forward 100 ms" onClick={() => onSeek(Math.min(page.duration, time + .1))}><SkipForward size={15} /></Button>
        <Button size="icon" variant="ghost" className={controlClass} aria-label="Go to end" title="Go to end (End)" onClick={() => onSeek(page.duration)}><ChevronLast size={16} /></Button>
        {onLoop && <Button size="icon" variant="ghost" className={`${controlClass} ${loop ? "bg-indigo-500/20 text-indigo-400" : ""}`} aria-label="Loop preview" aria-pressed={loop} title="Loop preview" onClick={onLoop}><Repeat2 size={15} /></Button>}
        <output aria-label="Current timeline time" className="mx-2 font-mono text-xs tabular-nums">{formatTimelineTime(time)} <span className="opacity-40">/ {formatTimelineTime(page.duration)}</span></output>
        <span className="mx-1 h-5 border-l border-slate-500/30" />
        <Button size="icon" variant="ghost" className={`${controlClass} ${snapping ? "bg-indigo-500/20 text-indigo-400" : ""}`} aria-label="Snap timeline clips" aria-pressed={snapping} title="Snap to playhead and clip edges (Alt to bypass)" onClick={() => setSnapping((value) => !value)}><Magnet size={16} /></Button>
        <Button size="icon" variant="ghost" className={controlClass} aria-label="Zoom timeline out" title="Zoom out (−)" disabled={zoom <= 1} onClick={() => changeZoom(zoom / 1.25)}><Minus size={15} /></Button>
        <Input type="range" aria-label="Timeline zoom" min={1} max={16} step={.25} value={zoom} onChange={(event) => changeZoom(Number(event.target.value))} className="h-6 w-20 border-0 bg-transparent px-0 shadow-none accent-indigo-500" />
        <Button size="icon" variant="ghost" className={controlClass} aria-label="Zoom timeline in" title="Zoom in (+)" disabled={zoom >= 16} onClick={() => changeZoom(zoom * 1.25)}><Plus size={15} /></Button>
        <Button size="icon" variant="ghost" className={controlClass} aria-label="Fit timeline" title="Fit slide duration" onClick={() => { setZoom(1); if (scrollRef.current) scrollRef.current.scrollLeft = 0; }}><Expand size={15} /></Button><span className="w-10 font-mono text-[10px] opacity-60">{Math.round(zoom * 100)}%</span>
        <div aria-label="Audio monitor" className="ml-2 flex items-center gap-1 border-l border-slate-500/30 pl-2"><Button size="icon" variant="ghost" className={`${controlClass} ${audio.muted ? "text-rose-400" : ""}`} aria-label={audio.muted ? "Unmute audio monitor" : "Mute audio monitor"} aria-pressed={audio.muted} title="Preview audio monitor" onClick={() => changeMonitor({ ...audio, muted: !audio.muted })}>{audio.muted ? <VolumeX size={16} /> : <Volume2 size={16} />}</Button><Input aria-label="Monitor volume" type="range" min={0} max={1} step={.01} value={audio.volume} onChange={(event) => changeMonitor({ ...audio, volume: Number(event.target.value) })} className="h-6 w-16 border-0 bg-transparent px-0 shadow-none accent-emerald-500" /><span className="w-8 font-mono text-[10px] opacity-60">{audio.muted ? "OFF" : Math.round(audio.volume * 100)}</span></div>
        <div className="ml-auto flex items-center gap-1"><label className="flex items-center gap-2 text-[10px] opacity-80">Duration<Input aria-label="Page duration" type="number" min={1} max={3600} step={.001} value={page.duration} disabled={disabled} onChange={(event) => onDuration(Number(event.target.value))} className="h-7 w-16 border-slate-500/30 bg-transparent px-2 text-xs text-inherit" />s</label><Button size="icon" variant="ghost" className={controlClass} aria-label="Add audio track" title="Add audio track" disabled={disabled || page.layers.length >= 100} onClick={() => onAddMedia("audio")}><Music size={16} /></Button><Button size="icon" variant="ghost" className={controlClass} aria-label="Add video track" title="Add video track" disabled={disabled || page.layers.length >= 100} onClick={() => onAddMedia("video")}><Video size={16} /></Button><Button size="icon" variant="ghost" className={controlClass} aria-label="Toggle timeline color theme" title="Toggle light/dark timeline" onClick={() => setDark((value) => !value)}>{dark ? <Sun size={15} /> : <Moon size={15} />}</Button><Button size="icon" variant="ghost" className={controlClass} aria-label={maximized ? "Restore timeline workspace" : "Maximize timeline workspace"} title="Maximize timeline" onClick={() => setMaximized((value) => !value)}>{maximized ? <RotateCcw size={15} /> : <Maximize2 size={15} />}</Button></div>
      </div>
      <Input aria-label="Timeline playhead" type="range" min={0} max={page.duration} step={.001} value={time} onChange={(event) => onSeek(Number(event.target.value))} className="sr-only w-px max-w-px" />
      <div ref={scrollRef} data-timeline-scroll className="min-h-0 flex-1 overflow-auto overscroll-contain px-3 pb-2">
        <div className="relative" style={{ minWidth: nameWidth + trackWidth + 168 }}>
          <div className="sticky top-0 z-40 grid items-center gap-2 bg-[var(--timeline-bg)] text-[10px]" style={{ gridTemplateColumns: "var(--timeline-columns)" }}>
            <div className="sticky left-0 z-50 flex h-9 items-center justify-between bg-[var(--timeline-bg)] pr-1"><span className="tracking-wider opacity-60">LAYERS · {page.layers.length}</span><Button role="separator" aria-label="Resize track names" aria-orientation="vertical" aria-valuemin={160} aria-valuemax={360} aria-valuenow={nameWidth} variant="ghost" className="h-8 w-3 cursor-col-resize touch-none rounded-none p-0 text-inherit" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); columnRef.current = { x: event.clientX, width: nameWidth }; }} onPointerMove={(event) => { const gesture = columnRef.current; if (gesture) setNameWidth(Math.max(160, Math.min(360, gesture.width + event.clientX - gesture.x))); }} onPointerUp={() => { columnRef.current = null; }} onPointerCancel={() => { columnRef.current = null; }} onLostPointerCapture={() => { columnRef.current = null; }} onKeyDown={(event) => { if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); setNameWidth((value) => Math.max(160, Math.min(360, value + (event.key === "ArrowLeft" ? -10 : 10)))); } }}><span className="h-4 border-l border-slate-500" /></Button></div>
            <Button variant="ghost" role="slider" aria-label="Timeline ruler" aria-valuemin={0} aria-valuemax={page.duration} aria-valuenow={time} aria-valuetext={formatTimelineTime(time)} className="relative h-9 cursor-crosshair touch-none overflow-hidden rounded-none p-0 text-inherit hover:bg-transparent hover:text-inherit" onPointerDown={(event) => { if (event.button !== 0) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); event.currentTarget.focus({ preventScroll: true }); seekRef.current = event.pointerId; seek(event); }} onPointerMove={(event) => { if (seekRef.current === event.pointerId) seek(event); }} onPointerUp={() => { seekRef.current = null; }} onPointerCancel={() => { seekRef.current = null; }} onLostPointerCapture={() => { seekRef.current = null; }} onKeyDown={(event) => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) { event.preventDefault(); onSeek(event.key === "Home" ? 0 : event.key === "End" ? page.duration : Math.max(0, Math.min(page.duration, time + (event.key === "ArrowLeft" ? -.1 : .1)))); } }} style={{ backgroundImage: "repeating-linear-gradient(to right, transparent 0, transparent calc(var(--timeline-tick) - 1px), #94a3b840 calc(var(--timeline-tick) - 1px), #94a3b840 var(--timeline-tick))", backgroundSize: "100% 6px", backgroundPosition: "bottom", backgroundRepeat: "no-repeat" }}>{ticks.map((tick) => <span key={tick} className="pointer-events-none absolute top-1 border-l border-slate-500/50 pl-1 font-mono text-[10px] font-normal opacity-70" style={{ left: timelineTimeToPixels(tick, pixelsPerSecond) }}>{tick < 60 ? `${tick}s` : formatTimelineTime(tick)}</span>)}<span className="pointer-events-none absolute inset-y-0 z-20 border-l-2 border-rose-400" style={{ left: "var(--timeline-playhead)" }}><span className="absolute -left-1 top-0 size-2 rotate-45 bg-rose-400" /></span></Button>
            <span className="sticky right-20 z-50 bg-[var(--timeline-bg)] py-2 opacity-70">IN (s)</span><span className="sticky right-0 z-50 bg-[var(--timeline-bg)] py-2 opacity-70">OUT (s)</span>
          </div>
          {master?.enabled && <div data-master-track className="grid items-center gap-2 py-1 text-[10px] text-emerald-500" style={{ gridTemplateColumns: "var(--timeline-columns)" }}><span className="sticky left-0 z-30 bg-[var(--timeline-bg)] py-2">Master · Protected</span><div className="rounded bg-emerald-500/10 p-2">Background{master.header.enabled ? " · Header and logo" : ""}{master.footer.enabled ? " · Footer and number" : ""} · Always visible</div><span className="sticky right-20 z-30 bg-[var(--timeline-bg)]">0s</span><span className="sticky right-0 z-30 bg-[var(--timeline-bg)]">{page.duration}s</span></div>}
          {rows.map((block) => <TimelineTrack key={block.id} block={block} duration={page.duration} pixelsPerSecond={pixelsPerSecond} selected={selectedId === block.id} disabled={disabled} muted={audio.mutedLayerIds.includes(block.id)} solo={audio.soloLayerIds.includes(block.id)} onSelect={select} onBegin={begin} onDrag={drag} onFinish={finish} onCancel={cancel} onAdjust={adjust} onMonitor={toggleTrackMonitor} />)}
        </div>
      </div>
      <div className="flex shrink-0 justify-between gap-3 border-t border-slate-500/20 px-3 py-1 text-[10px] opacity-55"><span>Drag a clip to move · Drag edges to trim · Alt bypasses snapping · Esc cancels</span><span>Audio monitor affects preview only</span></div>
    </section>
  </>;
}
