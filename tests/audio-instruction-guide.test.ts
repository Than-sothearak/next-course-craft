import { describe, expect, it } from "vitest";
import { audioGuideConnector, audioGuidePopupSchema, audioInstructionGuideSchema, defaultAudioInstructionGuide, fitAudioGuidePoint, fitAudioGuidePopup } from "@/lib/editor/audio-instruction-guide";
import { audioInstructionBlockSchema, blockSchema } from "@/lib/schemas/block";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { parseScorm12Snapshot } from "@/lib/scorm12/snapshot";
import { courseAssetIds, remapCourseAssetUrls } from "@/lib/media/asset-references";

const block = audioInstructionBlockSchema.parse({ id: "audio", version: 1, type: "audioInstruction", data: { src: "/api/assets/aaaaaaaaaaaaaaaaaaaaaaaa/file" } });

describe("audio instruction popup guide contract", () => {
  it("keeps older instructions unchanged and initializes an optional guide with independent point and popup positions", () => {
    expect(block.data.guide).toBeUndefined();
    expect(defaultAudioInstructionGuide.enabled).toBe(false);
    expect(audioInstructionGuideSchema.parse({ enabled: true })).toMatchObject({ enabled: true, point: { x: 45, y: 50 }, popup: { x: 55, y: 28, width: 36, height: 34 } });
    expect(audioInstructionGuideSchema.parse({ enabled: true })).toMatchObject({ timing: "with", animation: { effect: "slide-up", duration: 1000, delay: 0 } });
  });

  it.each([{ enabled: "true" }, { timing: "during" }, { animation: { effect: "spin" } }, { animation: { duration: 99 } }, { animation: { delay: -1 } }, { animation: { delay: 30001 } }, { animation: { delay: "1000" } }, { title: "x".repeat(121) }, { text: "x".repeat(3001) }, { point: { x: -1, y: 50 } }, { point: { x: 50, y: 101 } }, { point: { x: Number.NaN, y: 50 } }, { popup: { x: 80, y: 20, width: 36, height: 34 } }, { popup: { x: 20, y: 90, width: 36, height: 34 } }, { popup: { x: 0, y: 0, width: 15, height: 30 } }, { pointColor: "url(unsafe)" }])("rejects invalid guide content or geometry: %j", (guide) => {
    expect(blockSchema.safeParse({ ...block, data: { ...block.data, guide } }).success).toBe(false);
  });

  it("bounds point movement and popup movement or resizing to the full canvas", () => {
    expect(fitAudioGuidePoint({ x: -20, y: 140 })).toEqual({ x: 0, y: 100 });
    const box = defaultAudioInstructionGuide.popup;
    expect(fitAudioGuidePopup(box, { x: 200, y: -20 })).toEqual({ ...box, x: 64, y: 0 });
    expect(fitAudioGuidePopup(box, { width: 100, height: 100 })).toEqual({ ...box, width: 45, height: 72 });
    for (const update of [{ width: -30, height: -40 }, { width: 400, height: 400 }, { x: -20, y: 120 }]) expect(audioGuidePopupSchema.safeParse(fitAudioGuidePopup(box, update)).success).toBe(true);
    expect(audioGuideConnector(defaultAudioInstructionGuide)).toEqual({ x: 55, y: 50 });
  });

  it("retains guide text, geometry and colors through editor, cover and offline export snapshots", () => {
    const guide = audioInstructionGuideSchema.parse({ enabled: true, title: "Look here", text: "This chart shows the result.", timing: "after", animation: { effect: "zoom", duration: 700, delay: 5000 }, point: { x: 25, y: 70 }, popup: { x: 40, y: 20, width: 40, height: 35 }, pointColor: "#16a34a" });
    const snapshot = editorSnapshotSchema.parse({ title: "Guide", description: "", revision: 1, courseLayout: "slides", sections: [{ id: "section", title: "Slides", order: 0 }], lessons: [{ id: "cover", sectionId: "section", title: "Cover", order: 0, slideCover: { template: "imageCover" }, blocks: [{ ...block, data: { ...block.data, guide } }] }] });
    const exported = parseScorm12Snapshot(snapshot);
    const offline = remapCourseAssetUrls(exported, new Map([["a".repeat(24), "./media/instructions.mp3"]]));
    expect(courseAssetIds(offline).size).toBe(0);
    expect(offline.lessons[0].blocks[0]).toMatchObject({ data: { src: "./media/instructions.mp3", guide } });
  });
});
