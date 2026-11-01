import { describe, expect, it } from "vitest";
import { blockSchema, blockTypes, interactionButtonBlockSchema, popupContentBlockSchema, type ContentBlock } from "@/lib/schemas/block";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { duplicateLessonContent, removeLessonBlock } from "@/lib/editor/course-content";
import { courseAssetIds, remapCourseAssetUrls } from "@/lib/media/asset-references";
import { getPendingInteractiveProgressIds, getRestrictedLessonProgress } from "@/lib/export/progress";
import { parseScorm12Snapshot } from "@/lib/scorm12/snapshot";
import { blockTemplates } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/block-template-data";
import { createBlocksFromTemplate } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/create-blocks-from-template";

const url = (id: string) => `/api/assets/${id.repeat(24)}/file`;
const text = popupContentBlockSchema.parse({ id: "text", type: "richText", version: 1, data: { html: "<p>Discover more</p>" }, slideFrame: { x: 10, y: 10, width: 80, height: 70, z: 0 } });
const button = interactionButtonBlockSchema.parse({ id: "button", type: "interactionButton", version: 1, data: { popup: { blocks: [text] } } });
const snapshot = editorSnapshotSchema.parse({ title: "Interactions", description: "", revision: 0, courseLayout: "slides", sections: [{ id: "section", title: "Slides", order: 0 }], lessons: [{ id: "lesson", title: "Details", sectionId: "section", order: 0, blocks: [button, text] }] });

describe("interaction button content contract", () => {
  it("creates a valid preset with an editable popup and independent defaults", () => {
    const template = blockTemplates.find((item) => item.id === "interactive-button")!;
    const first = createBlocksFromTemplate(template, "first")[0];
    const second = createBlocksFromTemplate(template, "second")[0];
    expect(first).toMatchObject({ type: "interactionButton", blockPadding: 0, data: { trigger: "icon", radarEnabled: true, popup: { animation: "zoom", blocks: [{ type: "richText" }] } } });
    expect(blockSchema.safeParse(first).success).toBe(true);
    if (first.type !== "interactionButton" || second.type !== "interactionButton") throw new Error("Wrong template type");
    expect(first.data.popup.blocks[0].id).not.toBe(second.data.popup.blocks[0].id);
  });

  it.each([
    { icon: "script" }, { action: "javascript" }, { color: "url(https://example.com)" },
    { imageSrc: "javascript:alert(1)" }, { radius: -1 }, { iconSize: 1000 },
    { buttonSize: 0 }, { buttonSize: 257 }, { position: "outside" },
    { radarSize: -1 }, { radarSize: 25 }, { radarSize: 1.5 }, { radarSize: "3" },
    { radarWeight: 0 }, { radarWeight: 9 }, { radarWeight: 1.5 }, { radarWeight: "2" },
    { popup: { width: 10000 } }, { popup: { animation: "spin" } },
    { popup: { blocks: [{ ...text, type: "unknown" }] } }, { popup: { blocks: [text, text] } },
    { popup: { blocks: Array.from({ length: 21 }, (_, i) => ({ ...text, id: `${i}` })) } },
  ])("rejects invalid popup configuration: %j", (data) => {
    expect(blockSchema.safeParse({ ...button, data: { ...button.data, ...data } }).success).toBe(false);
  });

  it("accepts every regular slide block type and retains it in editor and SCORM snapshots", () => {
    const examples = new Map<ContentBlock["type"], ContentBlock>(blockTemplates.flatMap((template) => createBlocksFromTemplate(template, template.id)).map((block) => [block.type, block]));
    examples.set("heading", blockSchema.parse({ id: "heading", version: 1, type: "heading", data: { text: "Heading", level: 2 } }));
    examples.set("lessonMap", blockSchema.parse({ id: "map", version: 1, type: "lessonMap", data: { checkpoints: [] } }));
    expect([...examples.keys()].sort()).toEqual([...blockTypes, "lessonMap"].sort());
    for (const child of examples.values()) {
      const parent = interactionButtonBlockSchema.parse({ ...button, data: { ...button.data, popup: { blocks: [child] } } });
      const parsed = parseScorm12Snapshot({ ...snapshot, lessons: [{ ...snapshot.lessons[0], blocks: [parent] }] });
      expect(parsed.lessons[0].blocks[0]).toMatchObject({ data: { popup: { blocks: [{ type: child.type }] } } });
    }
  });

  it("bounds nested popup depth while allowing nested interaction buttons", () => {
    let nested: ContentBlock = text;
    for (let depth = 0; depth < 8; depth++) nested = blockSchema.parse({ ...button, id: `level-${depth}`, data: { ...button.data, popup: { blocks: [nested] } } });
    expect(blockSchema.safeParse(nested).success).toBe(true);
    expect(blockSchema.safeParse({ ...button, data: { ...button.data, popup: { blocks: [nested] } } }).success).toBe(false);
    expect(interactionButtonBlockSchema.safeParse({ ...button, data: { ...button.data, popup: { blocks: [nested] } } }).success).toBe(false);
  });

  it("duplicates nested popup IDs and sibling links independently at every level", () => {
    const nested = interactionButtonBlockSchema.parse({ ...button, id: "nested", data: { ...button.data, action: "block", targetBlockId: "text" } });
    const parent = interactionButtonBlockSchema.parse({ ...button, data: { ...button.data, popup: { blocks: [text, nested] } } });
    let index = 0;
    const copied = duplicateLessonContent({ ...snapshot.lessons[0], blocks: [parent] }, () => `copy-${++index}`).blocks[0];
    if (copied.type !== "interactionButton") throw new Error("Wrong type");
    const copiedNested = copied.data.popup.blocks[1];
    if (copiedNested.type !== "interactionButton") throw new Error("Wrong type");
    expect(copiedNested.data.targetBlockId).toBe(copied.data.popup.blocks[0].id);
    expect(copiedNested.data.popup.blocks[0].id).not.toBe(text.id);
    expect(parent.data.popup.blocks[1]).toMatchObject({ data: { targetBlockId: "text" } });
  });

  it.each([[0, 1], [7, 4], [24, 8]])("preserves radar size %s and weight %s through snapshots and static export", (radarSize, radarWeight) => {
    const configured = { ...button, data: { ...button.data, radarSize, radarWeight } };
    const parsed = editorSnapshotSchema.parse({ ...snapshot, lessons: [{ ...snapshot.lessons[0], blocks: [configured] }] });
    expect(parseScorm12Snapshot(parsed).lessons[0].blocks[0]).toMatchObject({ data: { radarSize, radarWeight } });
  });

  it("packages nested images, videos, audio and the trigger for offline HTML and SCORM", () => {
    const mediaButton = interactionButtonBlockSchema.parse({ ...button, data: { ...button.data, trigger: "image", imageSrc: url("a"), popup: { blocks: [text,
      { id: "image", version: 1, type: "image", data: { src: url("a"), alt: "Diagram" }, slideMedia: { source: url("a"), width: 400, height: 300 } },
      { id: "video", version: 1, type: "video", data: { src: url("b"), mimeType: "video/mp4" } },
      { id: "audio", version: 1, type: "audio", data: { src: url("c"), fileName: "Voice", mimeType: "audio/mpeg" } },
    ] } } });
    const parsed = parseScorm12Snapshot({ ...snapshot, lessons: [{ ...snapshot.lessons[0], blocks: [mediaButton] }] });
    expect([...courseAssetIds(parsed)]).toEqual(["a".repeat(24), "b".repeat(24), "c".repeat(24)]);
    for (const prefix of ["./media/", "data:audio/mpeg;base64,"]) {
      const offline = remapCourseAssetUrls(parsed, new Map(["a", "b", "c"].map((id) => [id.repeat(24), `${prefix}${id}`])));
      expect(courseAssetIds(offline).size).toBe(0);
      expect(JSON.stringify(offline)).toContain(`${prefix}c`);
      expect(offline.lessons[0].blocks[0]).toMatchObject({ data: { imageSrc: `${prefix}a`, popup: { blocks: [text, { slideMedia: { source: `${prefix}a` } }, {}, { data: { src: `${prefix}c` } }] } } });
    }
  });

  it("keeps popup objects and linked targets independent when duplicating a lesson", () => {
    const source = { ...snapshot.lessons[0], blocks: [{ ...button, data: { ...button.data, action: "block" as const, targetBlockId: text.id } }, text] };
    let index = 0;
    const copied = duplicateLessonContent(source, () => `copy-${++index}`);
    const copiedButton = copied.blocks[0];
    if (copiedButton.type !== "interactionButton") throw new Error("Wrong type");
    expect(copiedButton.data.targetBlockId).toBe(copied.blocks[1].id);
    expect(copiedButton.data.popup.blocks[0].id).not.toBe(text.id);
    expect(copiedButton.data.popup.blocks[0].data).toEqual(text.data);
    expect(source.blocks[0]).toMatchObject({ data: { targetBlockId: text.id } });
    expect(removeLessonBlock(copied.blocks, copied.blocks[1].id)[0]).toMatchObject({ data: { targetBlockId: "" } });
  });

  it("requires opening configured buttons, respects optional activities and skips unavailable targets", () => {
    expect(getPendingInteractiveProgressIds([button], new Set())).toEqual(["button:opened"]);
    expect(getRestrictedLessonProgress(100, [button], new Set(["button:opened"]))).toBe(100);
    expect(getPendingInteractiveProgressIds([{ ...button, requiredForProgress: false }], new Set())).toEqual([]);
    for (const targetBlockId of ["", "missing", "button", "other-button", "continue"]) {
      const linked = { ...button, data: { ...button.data, action: "block" as const, targetBlockId } };
      expect(getPendingInteractiveProgressIds([linked, { ...button, id: "other-button", requiredForProgress: false }], new Set())).toEqual([]);
    }
    const linked = { ...button, data: { ...button.data, action: "block" as const, targetBlockId: text.id } };
    expect(getPendingInteractiveProgressIds([linked, text], new Set())).toEqual(["button:opened"]);
    expect(getPendingInteractiveProgressIds([{ ...button, data: { ...button.data, popup: { ...button.data.popup, blocks: [] } } }], new Set())).toEqual([]);
  });
});
