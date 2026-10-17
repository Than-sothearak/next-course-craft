import { describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { learningBlockKinds, createLearningBlock, learningBlockSchema, learningPageSchema, layerActive, pageRequirementsMet } from "../lib/slides/blocks";
import { composeLearningPage, duplicateLearningBlock } from "../lib/slides/pages";
import { restorePageProgress } from "../lib/slides/progress";
import { createTemplateSlide } from "../lib/slides/templates";
import { slideSnapshotSchema } from "../lib/slides/schema";
import { Slide } from "../models/Slide";
import { serializeStoredSlide } from "../lib/slides/service";
import { mediaUploadInputSchema, maximumUploadBytes } from "../lib/media/schemas";

describe("content pages composed of editable timeline blocks", () => {
  it.each(learningBlockKinds)("creates a functional %s block with validated defaults", (kind) => {
    const block = createLearningBlock(kind);
    expect(learningBlockSchema.parse(block)).toEqual(block);
    expect(block.start).toBe(0); expect(block.end).toBeNull();
  });
  it("preserves every slot and design when wrapping an existing template as a block", () => {
    const source = { ...createTemplateSlide("image-text", 0), id: "page" };
    source.template!.slots.title = { type: "text", content: "My authored explanation" };
    source.template!.retainedSlots.extra = { type: "text", content: "Keep me too" };
    source.template!.design.density = "compact";
    const before = structuredClone(source), page = composeLearningPage(source);
    expect(page.schemaVersion).toBe(3); expect(page.template).toBeUndefined();
    expect(page.composition?.layers[0]).toMatchObject({ kind: "template", content: source.template });
    expect(source).toEqual(before);
    expect(slideSnapshotSchema.safeParse((({ id, ...snapshot }) => { void id; return snapshot; })(page)).success).toBe(true);
  });
  it("keeps legacy canvas documents intact instead of silently removing objects", () => {
    const source = { ...slideSnapshotSchema.parse({ title: "Canvas", order: 0, objects: [{ id: "text", type: "text", content: "Keep", x: 0, y: 0, width: 200, height: 100 }], revision: 0 }), id: "canvas" };
    expect(() => composeLearningPage(source)).toThrow("Keep this canvas intact"); expect(source.objects[0].content).toBe("Keep");
  });
  it("round-trips all layer types through the actual Mongoose model and strict serializer", () => {
    const page = composeLearningPage({ ...createTemplateSlide("cover", 0), id: "page" });
    page.composition!.layers.push(...learningBlockKinds.map(createLearningBlock));
    page.composition!.resolution = "fullHd";
    const document = new Slide({ ...page, slideId: page.id, courseId: new Types.ObjectId() }).toObject();
    expect(serializeStoredSlide(document)).toEqual(page);
  });
  it("duplicates blocks independently without changing content or timing", () => {
    const block = createLearningBlock("accordion"), copy = duplicateLearningBlock({ ...block, start: 2, end: 9, locked: true });
    expect(copy.id).not.toBe(block.id); expect(copy.locked).toBe(false); expect(copy.start).toBe(2);
    if (copy.kind === "accordion") copy.items[0].body = "Only the copy";
    expect(block).not.toEqual(copy);
    if (block.kind === "accordion") expect(block.items[0].body).not.toBe("Only the copy");
  });
  it("rejects duplicate layer IDs, impossible timings, unknown data, and unsafe media", () => {
    const block = createLearningBlock("text");
    expect(learningPageSchema.safeParse({ duration: 30, layers: [block, block] }).success).toBe(false);
    expect(learningPageSchema.safeParse({ duration: 30, layers: [{ ...block, start: 30 }] }).success).toBe(false);
    expect(learningPageSchema.safeParse({ duration: 30, layers: [{ ...block, start: 8, end: 8 }] }).success).toBe(false);
    expect(learningPageSchema.safeParse({ duration: 30, layers: [{ ...block, end: 31 }] }).success).toBe(false);
    expect(learningBlockSchema.safeParse({ ...block, script: "alert(1)" }).success).toBe(false);
    expect(learningBlockSchema.safeParse({ ...createLearningBlock("video"), src: "javascript:alert(1)" }).success).toBe(false);
  });
  it("rejects invalid trim ranges and completion rules that could trap learners", () => {
    expect(learningBlockSchema.safeParse({ ...createLearningBlock("audio"), trimStart: 5, trimEnd: 2 }).success).toBe(false);
    expect(learningBlockSchema.safeParse({ ...createLearningBlock("audio"), required: true }).success).toBe(false);
    expect(learningBlockSchema.safeParse({ ...createLearningBlock("audio"), src: "https://example.com/a.mp3", loop: true, required: true }).success).toBe(false);
    expect(learningBlockSchema.safeParse({ ...createLearningBlock("quiz"), visible: false }).success).toBe(false);
    expect(learningBlockSchema.safeParse({ ...createLearningBlock("text"), required: true }).success).toBe(false);
  });
  it("distinguishes track timing from reading order and requires only configured activities", () => {
    const text = createLearningBlock("text"), quiz = { ...createLearningBlock("quiz"), start: 5, end: 20 };
    const page = learningPageSchema.parse({ layers: [text, quiz] });
    expect(layerActive(quiz, 4, 30)).toBe(false); expect(layerActive(quiz, 5, 30)).toBe(true); expect(layerActive(quiz, 20, 30)).toBe(false);
    expect(pageRequirementsMet(page, [text.id])).toBe(false); expect(pageRequirementsMet(page, [quiz.id])).toBe(true);
    expect(pageRequirementsMet({ ...page, layers: [text] }, [])).toBe(true);
  });
  it("restores current completion while rejecting stale, corrupt and unearned completion", () => {
    const page = composeLearningPage({ ...createTemplateSlide("cover", 0), id: "page" });
    const quiz = createLearningBlock("quiz"); page.composition!.layers.push(quiz);
    expect(restorePageProgress({ page: { revision: 0, completedBlocks: [], finished: true } }, [page]).page.finished).toBe(false);
    expect(restorePageProgress({ page: { revision: 0, completedBlocks: [quiz.id, "missing"], finished: true } }, [page]).page).toEqual({ revision: 0, completedBlocks: [quiz.id], finished: true });
    expect(restorePageProgress({ page: { revision: 1, completedBlocks: [quiz.id], finished: true } }, [page])).toEqual({});
    expect(restorePageProgress("invalid", [page])).toEqual({});
  });
});
describe("audio assets in the existing media pipeline", () => {
  it.each(["audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/wav", "audio/x-wav", "audio/ogg", "audio/webm"])("accepts %s with a 100 MB limit", (contentType) => {
    expect(mediaUploadInputSchema.safeParse({ fileName: "narration", contentType, size: 100 * 1024 * 1024 }).success).toBe(true);
    expect(mediaUploadInputSchema.safeParse({ fileName: "narration", contentType, size: 100 * 1024 * 1024 + 1 }).success).toBe(false);
  });
  it("retains the image/video limits", () => { expect(maximumUploadBytes("image/png")).toBe(25 * 1024 * 1024); expect(maximumUploadBytes("video/mp4")).toBe(250 * 1024 * 1024); });
});
