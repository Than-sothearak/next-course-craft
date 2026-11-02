import { describe, expect, it } from "vitest";
import { blockSchema } from "@/lib/schemas/block";
import { alignSlideSelection, distributeSlideSelection, groupSlideSelection, moveSlideSelection, normalizeSlideGroups, removeSlideSelection, resizeSlideSelection, selectionBounds, slideSelectionIds, slideSelectionUnits, ungroupSlideSelection } from "@/lib/editor/slide-selection";
import { appendSlideObjects, readSlideObjectsClipboard, serializeSlideObject, serializeSlideObjects } from "@/lib/editor/slide-clipboard";
import { duplicateLessonBlocks } from "@/lib/editor/course-content";
import { getSlideLayers, reorderSlideLayers } from "@/lib/editor/slide-layers";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { parseScorm12Snapshot } from "@/lib/scorm12/snapshot";
import { getPendingInteractiveProgressIds } from "@/lib/export/progress";

const area = { width: 960, height: 540 };
const make = (id: string, x: number, y = 20, z = 0) => blockSchema.parse({ id, type: "heading", version: 1, slideFrame: { x, y, width: 20, height: 20, rotation: 0, z }, slideTextLayout: { fitToText: false }, data: { text: id, level: 2 } });
const blocks = () => [make("one", 10), make("two", 40, 40, 1), make("three", 70, 20, 2)];
const uniqueId = () => { let next = 0; return () => `copy-${++next}`; };

describe("presentation selection geometry and groups", () => {
  it("validates optional authoring metadata and preserves legacy defaults", () => {
    expect(make("plain", 10).slideGroupId).toBeUndefined();
    for (const extra of [{ slideGroupId: "" }, { slideGroupId: "x".repeat(65) }, { slideLocked: "true" }, { slideHiddenInEditor: 1 }]) expect(blockSchema.safeParse({ ...make("plain", 10), ...extra }).success).toBe(false);
    expect(blockSchema.parse({ ...make("plain", 10), slideGroupId: "group", slideLocked: true, slideHiddenInEditor: false })).toMatchObject({ slideGroupId: "group", slideLocked: true, slideHiddenInEditor: false });
  });

  it("creates flat contiguous groups without changing geometry or reading order", () => {
    const source = blocks(), grouped = groupSlideSelection(source, ["one", "three"], "first", area);
    expect(getSlideLayers(grouped).map((block) => block.id)).toEqual(["three", "one", "two"]);
    expect(grouped.map((block) => block.id)).toEqual(source.map((block) => block.id));
    grouped.forEach((block, index) => expect({ ...block.slideFrame, z: 0 }).toEqual({ ...source[index].slideFrame, z: 0 }));
    expect(slideSelectionIds(grouped, "one")).toEqual(["one", "three"]);
    expect(slideSelectionIds(grouped, "one", "first")).toEqual(["one"]);
    expect(groupSlideSelection(grouped, ["one", "three"], "unused", area)).toBe(grouped);
    const merged = groupSlideSelection(grouped, ["one", "two", "three"], "merged", area);
    expect(slideSelectionUnits(merged)).toHaveLength(1);
    expect(merged.map((block) => block.slideGroupId)).toEqual(["merged", "merged", "merged"]);
    expect(ungroupSlideSelection(merged, ["one"]).every((block) => !block.slideGroupId)).toBe(true);
  });

  it("moves every selected frame by one bounded delta and leaves others intact", () => {
    const source = blocks(), next = moveSlideSelection(source, ["one", "two"], { x: 90, y: 90 }, area);
    expect(next[0].slideFrame).toMatchObject({ x: 50, y: 60 });
    expect(next[1].slideFrame).toMatchObject({ x: 80, y: 80 });
    expect(next[2]).toBe(source[2]);
    next.forEach((block) => expect(blockSchema.safeParse(block).success).toBe(true));
  });

  it("resizes proportionally around the fixed corner, preserves rotation and typography, and disables automatic frame fitting", () => {
    const source = blocks(); source[0].slideFrame!.rotation = 30;
    const next = resizeSlideSelection(source, ["one", "two"], 1.25, { x: 10, y: 20 }, area);
    expect(next[0].slideFrame).toMatchObject({ x: 10, y: 20, width: 25, height: 25, rotation: 30 });
    expect(next[1].slideFrame).toMatchObject({ x: 47.5, y: 45, width: 25, height: 25 });
    expect(next[0].data).toEqual(source[0].data); expect(next[0].slideTextLayout?.fitToText).toBe(false);
    expect(next[2]).toBe(source[2]);
    const limited = resizeSlideSelection(source, ["one", "two"], 100, { x: 10, y: 20 }, area);
    expect(limited[0].slideFrame!.width / source[0].slideFrame!.width).toBeCloseTo(limited[1].slideFrame!.width / source[1].slideFrame!.width);
    limited.forEach((block) => expect(blockSchema.safeParse(block).success).toBe(true));
  });

  it("limits shrinking for compact audio and rotated bounds outside the canvas", () => {
    const audio = blockSchema.parse({ id: "audio", version: 1, type: "audio", slideFrame: { x: 5, y: 70, width: 20, height: 1, z: 2 }, data: { src: "" } });
    const source = [make("rotated", 0), audio]; source[0].slideFrame!.rotation = 45;
    const box = selectionBounds(source, source.map((block) => block.id), area)!;
    const next = resizeSlideSelection(source, ["rotated", "audio"], .01, { x: box.left, y: box.top }, area);
    next.forEach((block) => expect(blockSchema.safeParse(block).success).toBe(true));
    expect(next[1].slideFrame!.height).toBeGreaterThanOrEqual(.5);
    const resizedAudio = resizeSlideSelection([audio], ["audio"], .01, { x: 0, y: 0 }, area)[0];
    expect(resizedAudio.slideFrame?.height).toBe(.5);
    if (resizedAudio.type === "audio") expect(resizedAudio.slidePlayback?.fitHeight).toBe(false);
  });

  it("aligns rotated visual bounds and distributes groups as whole units", () => {
    const source = blocks(); source[0].slideFrame!.rotation = 30;
    const aligned = alignSlideSelection(source, ["one", "two"], "middle", area);
    const a = selectionBounds(aligned, ["one"], area)!, b = selectionBounds(aligned, ["two"], area)!;
    expect(a.middle).toBeCloseTo(b.middle);
    const uneven = blocks(); uneven[1].slideFrame!.x = 35;
    const spaced = distributeSlideSelection(uneven, ["one", "two", "three"], "x", area)!;
    expect(spaced.map((block) => block.slideFrame!.x)).toEqual([10, 40, 70]);
    const grouped = groupSlideSelection([...uneven, make("four", 60, 60, 3)], ["one", "two"], "group", area);
    const alignedGroup = alignSlideSelection(grouped, grouped.map((block) => block.id), "top", area, true);
    expect(alignedGroup[1].slideFrame!.y - alignedGroup[0].slideFrame!.y).toBe(20);
    expect(distributeSlideSelection([make("a", 10), make("b", 15), make("c", 20)], ["a", "b", "c"], "x", area)).toBeNull();
  });

  it("blocks editing a locked or hidden group and reorders an unlocked group as one unit", () => {
    const grouped = groupSlideSelection(blocks(), ["one", "two"], "group", area);
    for (const flag of ["slideLocked", "slideHiddenInEditor"] as const) {
      const protectedBlocks = grouped.map((block) => block.id === "one" ? { ...block, [flag]: true } : block);
      expect(moveSlideSelection(protectedBlocks, ["two"], { x: 5, y: 5 }, area)).toBe(protectedBlocks);
      expect(removeSlideSelection(protectedBlocks, ["two"])).toBe(protectedBlocks);
      expect(reorderSlideLayers(protectedBlocks, "two", "three", area)).toBe(protectedBlocks);
    }
    expect(getSlideLayers(reorderSlideLayers(grouped, "one", "three", area)).map((block) => block.id)).toEqual(["two", "one", "three"]);
  });

  it("clears links on bulk deletion and removes singleton group metadata", () => {
    const source = groupSlideSelection(blocks(), ["one", "two"], "group", area);
    const trigger = blockSchema.parse({ id: "trigger", type: "interactionButton", version: 1, data: { action: "block", targetBlockId: "one" } });
    const next = removeSlideSelection([...source, trigger], ["one"]);
    expect(next.find((block) => block.id === "two")?.slideGroupId).toBeUndefined();
    expect(next.find((block) => block.id === "trigger")).toMatchObject({ data: { targetBlockId: "" } });
    expect(normalizeSlideGroups(source)).toEqual(source);
  });

  it("reads legacy clipboard data and gives copied groups independent IDs with remapped links", () => {
    const target = make("target", 10), trigger = blockSchema.parse({ id: "trigger", type: "interactionButton", version: 1, slideFrame: { x: 40, y: 20, width: 20, height: 20, z: 1 }, data: { action: "block", targetBlockId: "target" } });
    const grouped = groupSlideSelection([target, trigger], ["target", "trigger"], "group", area).map((block) => ({ ...block, slideLocked: true, slideHiddenInEditor: true }));
    const serialized = serializeSlideObjects("course", grouped, ["target", "trigger"], area);
    const malformed = JSON.parse(serialized); malformed.blocks.push(malformed.blocks[0]);
    expect(() => readSlideObjectsClipboard(JSON.stringify(malformed), "course")).toThrow("invalid");
    expect(readSlideObjectsClipboard(serializeSlideObject("course", target, 0, 1, area), "course")).toEqual([target]);
    const result = appendSlideObjects(readSlideObjectsClipboard(serialized, "course")!, grouped, uniqueId());
    const copied = result.blocks.slice(2);
    expect(copied[0].slideGroupId).toBe(copied[1].slideGroupId); expect(copied[0].slideGroupId).not.toBe("group");
    expect(copied[1]).toMatchObject({ data: { targetBlockId: copied[0].id } });
    expect(copied.every((block) => !block.slideLocked && !block.slideHiddenInEditor)).toBe(true);
    expect(() => readSlideObjectsClipboard(serialized, "other-course")).toThrow("this course");
    const duplicate = duplicateLessonBlocks(grouped, uniqueId());
    expect(duplicate[0].slideGroupId).not.toBe("group"); expect(duplicate.every((block) => block.slideLocked && block.slideHiddenInEditor)).toBe(true);
  });

  it("preserves relative stack order when pasting onto a canvas with a maximum z layer", () => {
    const sources = [make("front", 10, 20, 10), make("back", 50, 20, 1)];
    const result = appendSlideObjects(sources, [make("old", 20, 20, 500)], uniqueId());
    expect(getSlideLayers(result.blocks).map((block) => block.id)).toEqual([result.selectedIds[0], result.selectedIds[1], "old"]);
    result.blocks.forEach((block) => expect(blockSchema.safeParse(block).success).toBe(true));
  });

  it("retains authoring metadata without changing learner activities or static snapshots", () => {
    const trigger = blockSchema.parse({ id: "trigger", version: 1, type: "interactionButton", slideGroupId: "group", slideLocked: true, slideHiddenInEditor: true, data: { popup: { blocks: [make("nested", 10)] } } });
    const snapshot = editorSnapshotSchema.parse({ title: "Slides", description: "", revision: 0, courseLayout: "slides", sections: [{ id: "section", title: "Slides", order: 0 }], lessons: [{ id: "slide", sectionId: "section", title: "Activity", order: 0, blocks: [trigger] }] });
    expect(parseScorm12Snapshot(snapshot).lessons[0].blocks).toEqual([trigger]);
    const lesson = snapshot.lessons[0];
    expect(getPendingInteractiveProgressIds(lesson.blocks, new Set())).toEqual(["trigger:opened"]);
  });
});
