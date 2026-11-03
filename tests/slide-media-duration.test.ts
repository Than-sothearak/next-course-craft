import { describe, expect, it } from "vitest";
import {
  formatMediaDuration,
  getSlideMediaBlockIds,
  sumKnownMediaDurations,
} from "@/lib/editor/slide-media-duration";
import { blockSchema } from "@/lib/schemas/block";

describe("slide media duration helpers", () => {
  it("formats durations as minutes and seconds or hours, minutes, and seconds", () => {
    expect(formatMediaDuration(83.9)).toBe("1:23");
    expect(formatMediaDuration(3661)).toBe("1:01:01");
  });

  it("sums only known positive finite durations", () => {
    expect(sumKnownMediaDurations([65, 35])).toBe(100);
    expect(sumKnownMediaDurations([0, Number.NaN, Number.POSITIVE_INFINITY])).toBeNull();
  });

  it("counts only playable regular audio and video blocks", () => {
    const blocks = [
      blockSchema.parse({
        id: "audio",
        version: 1,
        type: "audio",
        data: {
          src: "/api/assets/123456789012345678901234/file",
          mimeType: "audio/mpeg",
        },
      }),
      blockSchema.parse({
        id: "video",
        version: 1,
        type: "video",
        data: { src: "/video.mp4", mimeType: "video/mp4" },
      }),
      blockSchema.parse({
        id: "external-video",
        version: 1,
        type: "video",
        data: { src: "https://example.com/watch" },
      }),
      blockSchema.parse({
        id: "audio-instruction",
        version: 1,
        type: "audioInstruction",
        data: { src: "/api/assets/123456789012345678901234/file" },
      }),
    ];
    expect(getSlideMediaBlockIds(blocks)).toEqual(["audio", "video"]);
  });

  it("omits invalid formatted durations", () => {
    expect(formatMediaDuration(Number.NaN)).toBeNull();
    expect(formatMediaDuration(-1)).toBeNull();
  });
});
