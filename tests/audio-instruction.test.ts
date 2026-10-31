import { describe, expect, it } from "vitest";
import { audioInstructionBlockSchema, blockSchema } from "@/lib/schemas/block";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { migrateCoverAudio } from "@/lib/editor/audio-instruction";
import { courseAssetIds, remapCourseAssetUrls } from "@/lib/media/asset-references";
import { getPendingInteractiveProgressIds } from "@/lib/export/progress";
import { slideCoverSchema } from "@/lib/editor/slide-design";
import { parseScorm12Snapshot } from "@/lib/scorm12/snapshot";
import { blockTemplates } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/block-template-data";
import { createBlocksFromTemplate } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/create-blocks-from-template";

const src = "/api/assets/aaaaaaaaaaaaaaaaaaaaaaaa/file";
const block = audioInstructionBlockSchema.parse({ id: "instructions", version: 1, type: "audioInstruction", data: { src, fileName: "Welcome.mp3", mimeType: "audio/mpeg" } });
const snapshot = { title: "Instructions", description: "", revision: 0, courseLayout: "slides", sections: [{ id: "section", title: "Slides", order: 0 }], lessons: [{ id: "cover", sectionId: "section", title: "Cover", order: 0, slideCover: { template: "imageCover" }, blocks: [block] }] };

describe("audio instruction blocks", () => {
  it("creates an optional audio instruction template with editable icon, text and autoplay", () => {
    const template = blockTemplates.find((item) => item.id === "media-audio-instruction")!;
    expect(createBlocksFromTemplate(template, "new")[0]).toMatchObject({ type: "audioInstruction", blockPadding: 0, requiredForProgress: false, data: { src: "", autoPlay: false, showIcon: true, showText: true, label: "Audio instructions", color: "#f8fafc", textColor: "#334155" } });
  });
  it.each([{ src: "javascript:alert(1)" }, { src: "https://example.com/audio.mp3" }, { mimeType: "video/mp4" }, { autoPlay: "true" }, { showIcon: "false" }, { showText: 0 }, { color: "url(x)" }])("rejects invalid configuration: %j", (data) => {
    expect(blockSchema.safeParse({ ...block, data: { ...block.data, ...data } }).success).toBe(false);
  });
  it("allows audio instruction objects on covers and still rejects hidden lesson content", () => {
    expect(editorSnapshotSchema.safeParse(snapshot).success).toBe(true);
    expect(editorSnapshotSchema.safeParse({ ...snapshot, lessons: [{ ...snapshot.lessons[0], blocks: [{ id: "heading", version: 1, type: "heading", data: { text: "Hidden", level: 1 } }] }] }).success).toBe(false);
  });
  it.each(["cover", "start", "manual"] as const)("moves legacy %s audio to a block without changing the input or duplicating it", (audioTrigger) => {
    const original = { ...editorSnapshotSchema.parse({ ...snapshot, lessons: [{ ...snapshot.lessons[0], blocks: [] }] }).lessons[0], slideCover: slideCoverSchema.parse({ template: "imageCover", instructions: { audioSrc: src, audioName: "Welcome.mp3", audioTrigger, noticeEnabled: true, noticeTitle: "Read this", noticeText: "Course guidance" } }) };
    const migrated = migrateCoverAudio(original);
    expect(migrated.blocks).toHaveLength(1); expect(migrated.blocks[0]).toMatchObject({ type: "audioInstruction", requiredForProgress: false, data: { src, fileName: "Welcome.mp3", autoPlay: audioTrigger !== "manual" } });
    expect(migrated.slideCover.instructions).toMatchObject({ audioSrc: "", noticeEnabled: true, noticeTitle: "Read this", noticeText: "Course guidance" });
    expect(original.blocks).toHaveLength(0); expect(original.slideCover.instructions?.audioSrc).toBe(src); expect(migrateCoverAudio(migrated)).toBe(migrated);
    expect(migrateCoverAudio({ ...original, blocks: migrated.blocks }).blocks).toHaveLength(1);
  });
  it("packages the instruction audio and display options into static exports", () => {
    const parsed = parseScorm12Snapshot(snapshot), offline = remapCourseAssetUrls(parsed, new Map([["a".repeat(24), "./media/instructions.mp3"]]));
    expect([...courseAssetIds(parsed)]).toEqual(["a".repeat(24)]); expect(courseAssetIds(offline).size).toBe(0);
    expect(offline.lessons[0].blocks[0]).toMatchObject({ data: { src: "./media/instructions.mp3", showIcon: true, showText: true } });
    expect(getPendingInteractiveProgressIds([block], new Set())).toEqual([]);
    expect(getPendingInteractiveProgressIds([{ ...block, requiredForProgress: true }], new Set())).toEqual(["instructions:listened"]);
  });
});
