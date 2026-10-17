import type { LearningBlock } from "./blocks";

export const minimumTimelineHeight = 160;
export const defaultTimelineHeight = 280;
export const minimumPreviewWorkspace = 320;
export function timelinePanelHeight(value: number, workspaceHeight: number) {
  const maximum = Math.max(minimumTimelineHeight, workspaceHeight - minimumPreviewWorkspace);
  return Math.round(Math.max(minimumTimelineHeight, Math.min(maximum, value)));
}

export type TrimEdge = "start" | "end";
export const timelineMilliseconds = (seconds: number) => Math.round(seconds * 1_000);
export const timelineSeconds = (milliseconds: number) => Math.round(milliseconds) / 1_000;
const snap = (value: number) => timelineSeconds(timelineMilliseconds(value));
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export type PreviewAudioMonitor = { muted: boolean; volume: number; mutedLayerIds: string[]; soloLayerIds: string[] };
export const defaultAudioMonitor: PreviewAudioMonitor = { muted: false, volume: 1, mutedLayerIds: [], soloLayerIds: [] };
export function monitorLayerMuted(monitor: PreviewAudioMonitor, id: string) {
  return monitor.muted || monitor.mutedLayerIds.includes(id) || (monitor.soloLayerIds.length > 0 && !monitor.soloLayerIds.includes(id));
}

export function timelineTimeToPixels(seconds: number, pixelsPerSecond: number) { return timelineMilliseconds(seconds) / 1_000 * pixelsPerSecond; }
export function timelinePixelsToTime(pixels: number, pixelsPerSecond: number) { return pixelsPerSecond > 0 ? snap(pixels / pixelsPerSecond) : 0; }
export function timelineTickStep(pixelsPerSecond: number) {
  return [.01, .02, .05, .1, .2, .5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600].find((step) => step * pixelsPerSecond >= 72) ?? 3600;
}
export function formatTimelineTime(seconds: number) {
  const ms = Math.max(0, timelineMilliseconds(seconds));
  const hours = Math.floor(ms / 3_600_000), minutes = Math.floor(ms / 60_000) % 60, whole = Math.floor(ms / 1_000) % 60;
  return `${hours ? `${String(hours).padStart(2, "0")}:` : ""}${String(minutes).padStart(2, "0")}:${String(whole).padStart(2, "0")}.${String(ms % 1_000).padStart(3, "0")}`;
}

/** Snap in screen pixels, so the magnetic tolerance remains usable at every zoom. */
export function snapTimelineTime(requested: number, candidates: readonly number[], pixelsPerSecond: number, tolerance = 8) {
  let value = snap(requested), distance = pixelsPerSecond > 0 ? tolerance / pixelsPerSecond : 0;
  for (const candidate of candidates) { const next = Math.abs(candidate - requested); if (Number.isFinite(candidate) && next <= distance) { value = snap(candidate); distance = next; } }
  return value;
}

export function timelineSnapPoints(layers: readonly LearningBlock[], excludeId: string, duration: number, playhead: number) {
  return [...new Set([0, duration, playhead, ...layers.filter((layer) => layer.id !== excludeId).flatMap((layer) => [layer.start, layer.end ?? duration])])];
}

export function snapTimelineMove(block: LearningBlock, requested: number, duration: number, candidates: readonly number[], pixelsPerSecond: number) {
  const length = (block.end ?? duration) - block.start;
  return snapTimelineTime(requested, [...candidates, ...candidates.map((point) => point - length)], pixelsPerSecond);
}

/** Trimming changes source in/out for media; source files and layer order stay intact. */
export function trimTimelineLayer(block: LearningBlock, edge: TrimEdge, requested: number, duration: number): LearningBlock {
  if (block.locked || !Number.isFinite(requested) || duration <= 0) return block;
  const end = block.end ?? duration;
  const minimum = Math.min(.1, end - block.start);
  const isMedia = block.kind === "audio" || block.kind === "video";
  if (edge === "start") {
    const earliest = isMedia ? Math.max(0, block.start - block.trimStart) : 0;
    const sourceEnd = isMedia ? block.trimEnd ?? block.sourceDuration : undefined;
    const latest = isMedia && sourceEnd !== undefined && sourceEnd !== null ? Math.min(end - minimum, block.start + sourceEnd - block.trimStart - minimum) : end - minimum;
    const start = clamp(snap(requested), earliest, latest);
    return isMedia ? { ...block, start, trimStart: Math.max(0, snap(block.trimStart + start - block.start)) } : { ...block, start };
  }
  const maximum = isMedia && block.sourceDuration !== undefined ? Math.min(duration, block.start + block.sourceDuration - block.trimStart) : duration;
  const nextEnd = clamp(snap(requested), block.start + Math.min(.1, maximum - block.start), maximum);
  return isMedia ? { ...block, end: nextEnd, trimEnd: Math.min(block.sourceDuration ?? Infinity, snap(block.trimStart + nextEnd - block.start)) } : { ...block, end: nextEnd };
}

export function replaceBlockMedia(block: LearningBlock, src: string): LearningBlock {
  if (!("src" in block) || block.src === src) return block;
  if (block.kind === "image") return { ...block, src };
  return { ...block, src, sourceDuration: undefined, trimStart: 0, trimEnd: null, end: null, required: !!src && block.required };
}

/** Moving preserves duration and source in/out. An implicit page end becomes explicit when moved. */
export function moveTimelineLayer(block: LearningBlock, requestedStart: number, duration: number): LearningBlock {
  if (block.locked || !Number.isFinite(requestedStart) || !Number.isFinite(duration) || duration <= 0) return block;
  const clipLength = (block.end ?? duration) - block.start;
  const start = snap(clamp(snap(requestedStart), 0, Math.max(0, snap(duration - clipLength))));
  if (start === block.start) return block;
  return { ...block, start, end: snap(Math.min(duration, start + clipLength)) };
}

/** Numeric Start supports delaying an open-ended reveal; explicit clips move intact. */
export function scheduleTimelineLayer(block: LearningBlock, requested: number, duration: number): LearningBlock {
  if (block.end !== null) return moveTimelineLayer(block, requested, duration);
  if (block.locked || !Number.isFinite(requested) || duration <= 0) return block;
  return { ...block, start: snap(clamp(requested, 0, Math.max(0, duration - .1))) };
}

export function applyMediaDuration(block: LearningBlock, sourceDuration: number, pageDuration: number): LearningBlock {
  if ((block.kind !== "audio" && block.kind !== "video") || !Number.isFinite(sourceDuration) || sourceDuration <= 0 || sourceDuration > 86_400) return block;
  if (block.sourceDuration === sourceDuration) return block;
  const trimStart = Math.min(block.trimStart, Math.max(0, sourceDuration - .1));
  const trimEnd = block.trimEnd === null ? null : Math.max(trimStart + Math.min(.1, sourceDuration - trimStart), Math.min(block.trimEnd, sourceDuration));
  const maximumEnd = Math.min(pageDuration, block.start + (trimEnd ?? sourceDuration) - trimStart);
  return { ...block, sourceDuration, trimStart, trimEnd, end: Math.min(block.end ?? maximumEnd, maximumEnd) };
}

export function resetTimelineEnd(block: LearningBlock, duration: number): LearningBlock {
  if (block.locked) return block;
  if (block.kind !== "audio" && block.kind !== "video") return { ...block, end: null };
  return { ...block, trimEnd: null, end: block.sourceDuration === undefined ? null : Math.min(duration, block.start + block.sourceDuration - block.trimStart) };
}
