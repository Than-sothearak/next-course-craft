"use client";
import { memo, type PointerEvent } from "react";
import { Headphones, LockKeyhole, Music, Video, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LearningBlock } from "@/lib/slides/blocks";
import { formatTimelineTime, timelineTimeToPixels, type TrimEdge } from "@/lib/slides/timeline";

export type ClipGesture = "move" | TrimEdge;
export type ClipAdjustment = ClipGesture | "schedule";
type Props = { block: LearningBlock; duration: number; pixelsPerSecond: number; selected: boolean; disabled: boolean; muted: boolean; solo: boolean;
  onSelect: (id: string) => void; onBegin: (event: PointerEvent<HTMLButtonElement>, block: LearningBlock, mode: ClipGesture) => void;
  onDrag: (event: PointerEvent<HTMLButtonElement>) => void; onFinish: () => void; onCancel: () => void;
  onAdjust: (id: string, mode: ClipAdjustment, value: number | null) => void; onMonitor: (id: string, mode: "mute" | "solo") => void;
};
/** Playback moves the shared CSS playhead; unchanged clip rows do not render on every frame. */
export const TimelineTrack = memo(function TimelineTrack({ block, duration, pixelsPerSecond, selected, disabled, muted, solo, onSelect, onBegin, onDrag, onFinish, onCancel, onAdjust, onMonitor }: Props) {
  const media = block.kind === "audio" || block.kind === "video", end = block.end ?? duration;
  const tone = block.kind === "audio" ? "bg-emerald-600" : block.kind === "video" ? "bg-amber-600" : "bg-indigo-600";
  const hoverTone = block.kind === "audio" ? "hover:bg-emerald-500" : block.kind === "video" ? "hover:bg-amber-500" : "hover:bg-indigo-500";
  const handlers = { onPointerMove: onDrag, onPointerUp: onFinish, onPointerCancel: onCancel, onLostPointerCapture: onCancel };
  return <div data-timeline-row={block.id} data-track-selected={selected || undefined} className="grid items-center gap-2 border-b border-slate-500/15 py-1 text-xs" style={{ gridTemplateColumns: "var(--timeline-columns)" }}>
    <div className="sticky left-0 z-30 flex h-10 min-w-0 items-center gap-1 bg-[var(--timeline-bg)] pr-1">
      <Button variant="ghost" size="sm" className={`h-10 min-w-0 flex-1 justify-start gap-2 px-2 text-left text-inherit hover:bg-slate-500/15 hover:text-inherit ${selected ? "bg-indigo-500/20 ring-1 ring-inset ring-indigo-500/50" : ""}`} onClick={() => onSelect(block.id)}>
        {block.kind === "audio" ? <Music size={14} /> : block.kind === "video" ? <Video size={14} /> : <span className={`size-2 shrink-0 rounded-sm ${tone}`} />}
        <span className="min-w-0 truncate">{block.name}<span className="block text-[10px] font-normal opacity-60">{block.kind}{media && block.sourceDuration ? ` · ${formatTimelineTime(block.sourceDuration)}` : ""}</span></span>{block.locked && <LockKeyhole size={12} className="shrink-0 opacity-60" />}
      </Button>
      {media && <><Button variant="ghost" size="icon" className={`size-7 shrink-0 text-inherit hover:bg-slate-500/20 hover:text-inherit ${muted ? "text-rose-400" : ""}`} aria-label={`${muted ? "Unmute" : "Mute"} ${block.name} monitor`} aria-pressed={muted} title={`${muted ? "Unmute" : "Mute"} in preview`} onClick={() => onMonitor(block.id, "mute")}>{muted ? <VolumeX size={13} /> : <Volume2 size={13} />}</Button><Button variant="ghost" size="icon" className={`size-7 shrink-0 text-inherit hover:bg-slate-500/20 hover:text-inherit ${solo ? "bg-amber-500/20 text-amber-400" : ""}`} aria-label={`${solo ? "Unsolo" : "Solo"} ${block.name} monitor`} aria-pressed={solo} title="Solo in preview" onClick={() => onMonitor(block.id, "solo")}><Headphones size={13} /></Button></>}
    </div>
    <div data-timeline-track={block.id} className="relative h-10 rounded bg-slate-500/10" style={{ backgroundImage: "repeating-linear-gradient(to right, transparent 0, transparent calc(var(--timeline-tick) - 1px), #94a3b826 calc(var(--timeline-tick) - 1px), #94a3b826 var(--timeline-tick))" }}>
      <Button data-timeline-clip={block.id} variant="ghost" aria-label={`Move ${block.name} in time`} title={`Drag to move · ${formatTimelineTime(block.start)} – ${formatTimelineTime(end)}`} disabled={disabled || block.locked} className={`absolute top-1 h-8 min-h-8 min-w-0 cursor-grab touch-none justify-start overflow-hidden rounded border border-white/20 px-3 text-left text-[11px] text-white hover:text-white active:cursor-grabbing ${tone} ${hoverTone} ${selected ? "ring-2 ring-indigo-300" : ""} ${!block.visible ? "opacity-40" : ""}`} style={{ left: timelineTimeToPixels(block.start, pixelsPerSecond), width: Math.max(1, timelineTimeToPixels(end - block.start, pixelsPerSecond)) }} onClick={() => onSelect(block.id)} onPointerDown={(event) => onBegin(event, block, "move")} {...handlers} onKeyDown={(event) => { if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return; event.preventDefault(); event.stopPropagation(); onAdjust(block.id, "move", event.key === "Home" ? 0 : event.key === "End" ? duration : block.start + (event.key === "ArrowLeft" ? -1 : 1) * (event.shiftKey ? 1 : .1)); }}><span className="truncate">{block.name}</span></Button>
      {(["start", "end"] as const).map((edge) => <Button key={edge} role="slider" aria-label={`Trim ${block.name} ${edge}`} aria-orientation="horizontal" aria-valuemin={edge === "start" ? 0 : block.start} aria-valuemax={edge === "start" ? end : duration} aria-valuenow={edge === "start" ? block.start : end} aria-valuetext={formatTimelineTime(edge === "start" ? block.start : end)} variant="ghost" disabled={disabled || block.locked} className="absolute top-1 z-20 h-8 min-h-8 w-3 -translate-x-1/2 cursor-ew-resize touch-none rounded-sm border border-white/30 bg-slate-200/90 p-0 text-slate-900 hover:bg-white" style={{ left: timelineTimeToPixels(edge === "start" ? block.start : end, pixelsPerSecond) }} title={`Drag to trim ${edge}`} onPointerDown={(event) => onBegin(event, block, edge)} {...handlers} onKeyDown={(event) => { if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return; event.preventDefault(); event.stopPropagation(); const current = edge === "start" ? block.start : end; onAdjust(block.id, edge, event.key === "Home" ? 0 : event.key === "End" ? duration : current + (event.key === "ArrowLeft" ? -1 : 1) * (event.shiftKey ? 1 : .1)); }}><span aria-hidden="true" className="h-3 border-l-2 border-slate-600" /></Button>)}
      <div data-track-playhead className="pointer-events-none absolute inset-y-0 z-20 border-l border-rose-400" style={{ left: "var(--timeline-playhead)" }} />
    </div>
    <Input aria-label={`${block.name} start`} type="number" min={0} max={duration} step={.001} disabled={disabled || block.locked} value={block.start} className="sticky right-20 z-30 h-8 border-slate-500/30 bg-[var(--timeline-bg)] px-2 text-xs text-inherit" onChange={(event) => onAdjust(block.id, "schedule", Number(event.target.value))} />
    <Input aria-label={`${block.name} end`} type="number" min={0} max={duration} step={.001} placeholder="End" disabled={disabled || block.locked} value={block.end ?? ""} className="sticky right-0 z-30 h-8 border-slate-500/30 bg-[var(--timeline-bg)] px-2 text-xs text-inherit" onChange={(event) => onAdjust(block.id, "end", event.target.value === "" ? null : Number(event.target.value))} />
  </div>;
});
