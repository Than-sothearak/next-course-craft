import { describe, expect, it } from "vitest";
import { createLearningBlock, learningBlockSchema, learningPageSchema } from "../lib/slides/blocks";
import { applyMediaDuration, defaultAudioMonitor, formatTimelineTime, monitorLayerMuted, moveTimelineLayer, replaceBlockMedia, resetTimelineEnd, snapTimelineMove, snapTimelineTime, timelineMilliseconds, timelinePanelHeight, timelinePixelsToTime, timelineSnapPoints, timelineTickStep, timelineTimeToPixels, trimTimelineLayer } from "../lib/slides/timeline";
import { defaultTimelinePreferences, parseTimelinePreferences } from "../lib/slides/timeline-preferences";

describe("timeline resizing and track trimming", () => {
  it("bounds the divider so both timeline and preview retain space", () => {
    expect(timelinePanelHeight(400, 800)).toBe(400);
    expect(timelinePanelHeight(900, 800)).toBe(480);
    expect(timelinePanelHeight(10, 800)).toBe(160);
    expect(timelinePanelHeight(300, 300)).toBe(160);
  });
  it("trims ordinary layers with millisecond precision without crossing edges", () => {
    const block = { ...createLearningBlock("text"), start: 2, end: 20 };
    expect(trimTimelineLayer(block, "start", 5.23, 30)).toMatchObject({ start: 5.23, end: 20 });
    expect(trimTimelineLayer(block, "start", 30, 30)).toMatchObject({ start: 19.9, end: 20 });
    expect(trimTimelineLayer(block, "end", -10, 30)).toMatchObject({ start: 2, end: 2.1 });
    expect(trimTimelineLayer(block, "end", 50, 30)).toMatchObject({ end: 30 });
  });
  it.each(["audio", "video"] as const)("trims %s source metadata without changing the source file", (kind) => {
    const block = learningBlockSchema.parse({ ...createLearningBlock(kind), src: "https://example.com/lesson", sourceDuration: 20, start: 2, end: 22, trimStart: 0, trimEnd: 20 });
    const end = trimTimelineLayer(block, "end", 12, 30);
    const both = trimTimelineLayer(end, "start", 5, 30);
    expect(both).toMatchObject({ src: block.kind === "audio" || block.kind === "video" ? block.src : "", start: 5, end: 12, trimStart: 3, trimEnd: 10, sourceDuration: 20 });
    expect(block).toMatchObject({ start: 2, end: 22, trimStart: 0, trimEnd: 20 });
    expect(learningPageSchema.safeParse({ duration: 30, layers: [both] }).success).toBe(true);
    expect(trimTimelineLayer(both, "end", 30, 30)).toMatchObject({ end: 22, trimEnd: 20 });
    expect(trimTimelineLayer(both, "start", -10, 30)).toMatchObject({ start: 2, trimStart: 0 });
  });
  it("ignores locked tracks and invalid pointer values", () => {
    const block = { ...createLearningBlock("text"), locked: true };
    expect(trimTimelineLayer(block, "start", 4, 30)).toBe(block);
    const unlocked = { ...block, locked: false };
    expect(trimTimelineLayer(unlocked, "end", NaN, 30)).toBe(unlocked);
  });
  it("moves a scheduled media layer without discarding its source content", () => {
    const block = learningBlockSchema.parse({ ...createLearningBlock("audio"), start: 0, end: 10, trimStart: 2, trimEnd: 12 });
    expect(moveTimelineLayer(block, 5, 30)).toMatchObject({ start: 5, end: 15, trimStart: 2, trimEnd: 12 });
    expect(moveTimelineLayer(block, 29, 30)).toMatchObject({ start: 20, end: 30, trimStart: 2, trimEnd: 12 });
  });
  it("loads media duration and resets old trims when the file is replaced", () => {
    const block = learningBlockSchema.parse({ ...createLearningBlock("audio"), src: "https://example.com/first.mp3", trimStart: 2, trimEnd: 15 });
    const loaded = applyMediaDuration(block, 10, 30);
    expect(loaded).toMatchObject({ sourceDuration: 10, trimStart: 2, trimEnd: 10, end: 8 });
    expect(replaceBlockMedia(loaded, "https://example.com/second.mp3")).toMatchObject({ src: "https://example.com/second.mp3", trimStart: 0, trimEnd: null, end: null, sourceDuration: undefined });
    expect(applyMediaDuration(block, Infinity, 30)).toBe(block);
    expect(applyMediaDuration(block, 0, 30)).toBe(block);
    expect(resetTimelineEnd(loaded, 30)).toMatchObject({ trimStart: 2, trimEnd: null, end: 8 });
  });
  it("validates stored frame resolutions and trim bounds", () => {
    expect(learningPageSchema.parse({ layers: [], resolution: "fullHd" }).resolution).toBe("fullHd");
    expect(learningPageSchema.safeParse({ layers: [], resolution: "arbitrary" }).success).toBe(false);
    expect(learningBlockSchema.safeParse({ ...createLearningBlock("video"), sourceDuration: 10, trimEnd: 11 }).success).toBe(false);
    expect(learningBlockSchema.safeParse({ ...createLearningBlock("video"), sourceDuration: 10, trimStart: 10 }).success).toBe(false);
  });
  it("centralizes pixel/time conversion and adaptive millisecond ruler labels", () => {
    expect(timelineTimeToPixels(1.234, 100)).toBe(123.4);
    expect(timelinePixelsToTime(123.456, 100)).toBe(1.235);
    expect(timelinePixelsToTime(50, 0)).toBe(0);
    expect(timelineTickStep(40)).toBe(2); expect(timelineTickStep(160)).toBe(.5);
    expect(formatTimelineTime(65.012)).toBe("01:05.012"); expect(formatTimelineTime(3601.123)).toBe("01:00:01.123");
  });
  it("moves implicit-end clips without changing duration and clamps both ends", () => {
    const block = { ...createLearningBlock("text"), start: 5, end: null };
    expect(moveTimelineLayer(block, 0, 30)).toMatchObject({ start: 0, end: 25 });
    expect(moveTimelineLayer(block, 15, 30)).toBe(block);
    expect(moveTimelineLayer(block, -10, 30)).toMatchObject({ start: 0, end: 25 });
    expect(moveTimelineLayer({ ...block, locked: true }, 0, 30)).toMatchObject({ start: 5, end: null });
  });
  it("snaps either clip edge to the nearest playhead or other layer edge at any zoom", () => {
    const block = { ...createLearningBlock("text"), start: 2, end: 7 };
    const points = timelineSnapPoints([block, { ...createLearningBlock("image"), start: 10, end: 20 }], block.id, 30, 15);
    expect(points).toEqual([0, 30, 15, 10, 20]);
    expect(snapTimelineMove(block, 4.95, 30, points, 100)).toBe(5);
    expect(snapTimelineTime(14.96, points, 100)).toBe(15);
    expect(snapTimelineTime(14.96, points, 400)).toBe(14.96);
  });
  it("preserves millisecond clip length and source trims across repeated movements", () => {
    const initial = learningBlockSchema.parse({ ...createLearningBlock("audio"), start: .123, end: 5.456, trimStart: 2.123, trimEnd: 7.456 });
    let block = initial;
    for (let index = 0; index < 1000; index++) block = moveTimelineLayer(block, index % 2 ? .123 : 10.789, 30);
    expect(block).toEqual(initial); expect(timelineMilliseconds((block.end ?? 30) - block.start)).toBe(5333);
  });
  it("does not round fractional native media metadata beyond the source duration", () => {
    const block = learningBlockSchema.parse({ ...createLearningBlock("audio"), start: 2, end: 22.0436, sourceDuration: 20.0436, trimStart: 0, trimEnd: 20.0436 });
    const trimmed = trimTimelineLayer(block, "end", 30, 30);
    expect(trimmed).toMatchObject({ end: 22.0436, trimEnd: 20.0436 });
    expect(learningBlockSchema.safeParse(trimmed).success).toBe(true);
  });
  it("keeps preview mute/solo separate from authored source volume", () => {
    expect(monitorLayerMuted(defaultAudioMonitor, "audio")).toBe(false);
    expect(monitorLayerMuted({ ...defaultAudioMonitor, muted: true }, "audio")).toBe(true);
    expect(monitorLayerMuted({ ...defaultAudioMonitor, mutedLayerIds: ["audio"] }, "audio")).toBe(true);
    const solo = { ...defaultAudioMonitor, soloLayerIds: ["narration"] };
    expect(monitorLayerMuted(solo, "narration")).toBe(false); expect(monitorLayerMuted(solo, "video")).toBe(true);
  });
  it("validates browser preferences without changing slide data", () => {
    expect(parseTimelinePreferences({ zoom: 4, dark: false })).toMatchObject({ zoom: 4, dark: false, snapping: true });
    expect(parseTimelinePreferences({ zoom: 100 })).toEqual(defaultTimelinePreferences);
    expect(parseTimelinePreferences({ nameWidth: -10 })).toEqual(defaultTimelinePreferences);
  });
});
