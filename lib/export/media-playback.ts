import { z } from "zod";

// Use the browser's played ranges, never currentTime, as evidence of playback.
// Seeking changes currentTime without filling the skipped range.
const mediaTimeTolerance = 0.05;
const sourceKeys = new Map<string, string>();

export type MediaPlaybackProgress = { source: string; seconds: number; duration: number };
export type MediaProgress = Record<string, MediaPlaybackProgress>;

export function registerMediaProgressSource(src: string, assetId: string) {
  sourceKeys.set(src, assetId);
}

export function mediaProgressSource(src: string) {
  const assetId = sourceKeys.get(src) ?? src.match(/\/api\/assets\/([a-f\d]{24})\/file/i)?.[1];
  if (assetId) return assetId;
  // Keep data URLs and long external URLs out of LMS suspend data.
  let hash = 2166136261;
  for (let index = 0; index < src.length; index++) hash = Math.imul(hash ^ src.charCodeAt(index), 16777619);
  const key = (hash >>> 0).toString(16);
  sourceKeys.set(src, key);
  return key;
}

export function mediaProgressPercent(progress?: MediaPlaybackProgress) {
  if (!progress || !Number.isFinite(progress.seconds) || !Number.isFinite(progress.duration) || progress.duration <= 0) return 0;
  return Math.min(90, Math.max(0, Math.floor((progress.seconds / progress.duration + 1e-9) * 10) * 10));
}

export function validMediaProgress(value: unknown): MediaProgress {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).flatMap(([id, entry]) => {
    const parsed = mediaPlaybackProgressSchema.safeParse(entry);
    return parsed.success ? [[id, parsed.data]] : [];
  }));
}

const mediaPlaybackProgressSchema = z.object({ source: z.string().regex(/^[a-f\d]{1,24}$/i), seconds: z.number().finite().positive(), duration: z.number().finite().positive() }).refine((value) => value.seconds < value.duration);

export function createMediaPlaybackGuard() {
  let watchedThrough = 0;
  let completed = false;

  function update(media: HTMLMediaElement) {
    let contiguousEnd = watchedThrough;
    for (let index = 0; index < media.played.length; index++) {
      if (media.played.start(index) > contiguousEnd + mediaTimeTolerance) break;
      contiguousEnd = Math.max(contiguousEnd, media.played.end(index));
    }
    watchedThrough = Math.max(watchedThrough, contiguousEnd);
  }

  return {
    restore(media: HTMLMediaElement, progress?: MediaPlaybackProgress) {
      if (!progress || !Number.isFinite(media.duration) || Math.abs(media.duration - progress.duration) > mediaTimeTolerance || progress.seconds <= watchedThrough) return;
      watchedThrough = progress.seconds;
      if (media.played.length === 0 && media.currentTime === 0) media.currentTime = watchedThrough;
    },
    progress(media: HTMLMediaElement): Omit<MediaPlaybackProgress, "source"> {
      update(media);
      const duration = Number.isFinite(media.duration) && media.duration > 0 ? media.duration : 0;
      const percent = duration ? Math.min(90, Math.floor((watchedThrough / duration + 1e-9) * 10) * 10) : 0;
      return { seconds: duration * percent / 100, duration };
    },
    seeking(media: HTMLMediaElement) {
      if (completed) return;
      update(media);
      if (media.currentTime > watchedThrough) media.currentTime = watchedThrough;
    },
    update,
    finish(media: HTMLMediaElement) {
      update(media);
      if (completed) return true;
      if (!Number.isFinite(media.duration) || media.duration <= 0) return false;
      completed = watchedThrough >= media.duration - mediaTimeTolerance &&
        media.currentTime >= media.duration - mediaTimeTolerance;
      return completed;
    },
  };
}
