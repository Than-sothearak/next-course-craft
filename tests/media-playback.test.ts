/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { createMediaPlaybackGuard, mediaProgressPercent, mediaProgressSource, registerMediaProgressSource, validMediaProgress } from "@/lib/export/media-playback";
import { setMediaPlayback } from "./helpers/media-playback";

describe("continuous media playback", () => {
  it("advances a 40-second recording in ten checkpoints and caps incomplete playback at 90%", () => {
    const media = document.createElement("video");
    const guard = createMediaPlaybackGuard();
    for (let step = 0; step <= 10; step++) {
      const seconds = step * 4;
      setMediaPlayback(media, seconds ? [[0, seconds]] : [], seconds, 40);
      const progress = { ...guard.progress(media), source: "abc" };
      expect(mediaProgressPercent(progress)).toBe(Math.min(90, step * 10));
      expect(guard.finish(media)).toBe(step === 10);
    }
  });

  it("resumes only compatible duration checkpoints and merges subsequent played coverage", () => {
    const media = document.createElement("audio");
    const guard = createMediaPlaybackGuard();
    setMediaPlayback(media, [], 0, 40);
    guard.restore(media, { source: "abc", seconds: 20, duration: 50 });
    expect(media.currentTime).toBe(0);
    guard.restore(media, { source: "abc", seconds: 20, duration: 40 });
    expect(media.currentTime).toBe(20);
    setMediaPlayback(media, [[20, 24]], 24, 40);
    expect(guard.progress(media).seconds).toBe(24);
    media.currentTime = 39; guard.seeking(media);
    expect(media.currentTime).toBe(24);
    expect(guard.finish(media)).toBe(false);
  });

  it("keeps asset identity stable across exported blob URLs and ignores corrupt resume values", () => {
    const id = "aaaaaaaaaaaaaaaaaaaaaaaa";
    registerMediaProgressSource("blob:first-launch", id);
    registerMediaProgressSource("blob:second-launch", id);
    expect(mediaProgressSource("blob:first-launch")).toBe(mediaProgressSource(`/api/assets/${id}/file`));
    expect(mediaProgressSource("blob:second-launch")).toBe(id);
    expect(validMediaProgress({ bad: { source: "abc", seconds: NaN, duration: 40 }, full: { source: "abc", seconds: 40, duration: 40 }, valid: { source: "abc", seconds: 20, duration: 40 } })).toEqual({ valid: { source: "abc", seconds: 20, duration: 40 } });
  });
  it.each(["video", "audio"])("rejects seeking and an ended event without playing %s", (tag) => {
    const media = document.createElement(tag) as HTMLMediaElement;
    const guard = createMediaPlaybackGuard();
    setMediaPlayback(media, [], 10);
    expect(guard.finish(media)).toBe(false);
    guard.seeking(media);
    expect(media.currentTime).toBe(0);
    setMediaPlayback(media, [[0, 3], [9, 10]], 10);
    expect(guard.finish(media)).toBe(false);
    guard.seeking(media);
    expect(media.currentTime).toBe(3);
  });

  it("permits rewind, pause/resume and replay without crediting repeated time twice", () => {
    const media = document.createElement("video");
    const guard = createMediaPlaybackGuard();
    setMediaPlayback(media, [[0, 4]], 4); guard.update(media);
    media.currentTime = 1; guard.seeking(media); expect(media.currentTime).toBe(1);
    setMediaPlayback(media, [[0, 4]], 4); guard.update(media);
    media.currentTime = 9; guard.seeking(media); expect(media.currentTime).toBe(4);
    setMediaPlayback(media, [[0, 7]], 7); guard.update(media);
    expect(guard.finish(media)).toBe(false);
    setMediaPlayback(media, [[0, 10]], 10);
    expect(guard.finish(media)).toBe(true);
    media.currentTime = 2; guard.seeking(media); expect(media.currentTime).toBe(2);
    media.currentTime = 9; guard.seeking(media); expect(media.currentTime).toBe(9);
  });

  it("rejects missing beginning, gaps and unknown duration", () => {
    const media = document.createElement("audio");
    const guard = createMediaPlaybackGuard();
    for (const ranges of [[[2, 10]], [[0, 3], [5, 10]]] as const) {
      setMediaPlayback(media, ranges, 10);
      expect(guard.finish(media)).toBe(false);
    }
    for (const duration of [NaN, Infinity, 0]) {
      setMediaPlayback(media, [[0, 10]], 10, duration);
      expect(guard.finish(media)).toBe(false);
    }
  });
});
