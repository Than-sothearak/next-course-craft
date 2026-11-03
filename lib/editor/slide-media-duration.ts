import { isSlideVideoFile } from "@/lib/editor/slide-crop";
import type { ContentBlock } from "@/lib/schemas/block";

export function getSlideMediaBlockIds(blocks: readonly ContentBlock[]) {
  return blocks.flatMap((block) => {
    if (block.type === "audio" && block.data.src) return [block.id];
    if (block.type === "video" && isSlideVideoFile(block)) return [block.id];
    return [];
  });
}

export function sumKnownMediaDurations(durations: readonly number[]) {
  const knownDurations = durations.filter(
    (duration) => Number.isFinite(duration) && duration > 0,
  );
  return knownDurations.length
    ? knownDurations.reduce((total, duration) => total + duration, 0)
    : null;
}

export function formatMediaDuration(durationSeconds: number) {
  const wholeSeconds = Math.floor(durationSeconds);
  if (!Number.isFinite(wholeSeconds) || wholeSeconds < 0) return null;

  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const seconds = wholeSeconds % 60;
  const paddedSeconds = String(seconds).padStart(2, "0");

  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${paddedSeconds}`
    : `${minutes}:${paddedSeconds}`;
}
