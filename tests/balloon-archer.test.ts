import { describe, expect, it } from "vitest";
import { archerBalloonSchema } from "@/lib/schemas/balloon-archer";
import { balloonArcherBlockSchema, blockSchema, interactionButtonBlockSchema } from "@/lib/schemas/block";
import { advanceArcherShot, archerBalloonPosition, archerStringRecoil, constrainPull, firstArcherHit, launchArcherArrow } from "@/lib/interactive/balloon-archer";
import { getInteractiveBlockProgressIds, getPendingInteractiveProgressIds, getRestrictedLessonProgress } from "@/lib/export/progress";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { parseScorm12Snapshot } from "@/lib/scorm12/snapshot";
import { duplicateLessonBlocks } from "@/lib/editor/course-content";
import { blockTemplates } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/block-template-data";
import { createBlocksFromTemplate } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/create-blocks-from-template";

const make = () => balloonArcherBlockSchema.parse({ id: "archer", version: 1, type: "balloonArcher", data: {} });
describe("Balloon Archer contracts and physics", () => {
  it("defaults to a white field with black balloons and bow/arrow, and white word text", () => {
    const data = make().data;
    expect(data).toMatchObject({ backgroundColor: "#ffffff", balloonColor: "#000000", bowColor: "#000000", textColor: "#ffffff" });
    expect(data.balloons.every((balloon) => (balloon.color ?? data.balloonColor) === "#000000")).toBe(true);
  });
  it("creates validated blocks from the shared picker with fresh balloon IDs", () => {
    const template = blockTemplates.find((item) => item.id === "interactive-balloon-archer")!;
    const first = createBlocksFromTemplate(template, "one")[0], second = createBlocksFromTemplate(template, "two")[0];
    expect(blockSchema.safeParse(first).success).toBe(true); expect(first.type).toBe("balloonArcher");
    if (first.type !== "balloonArcher" || second.type !== "balloonArcher") throw new Error("Wrong block type");
    expect(first.data.balloons).toHaveLength(3); expect(first.width).toBe("full");
    expect(first.data.balloons.some((item) => second.data.balloons.some((other) => item.id === other.id))).toBe(false);
  });
  it("bounds balloon counts, content, colors, identity, and positions", () => {
    const block = make(), balloon = block.data.balloons[0];
    for (const invalid of [{ x: 7 }, { x: 93 }, { y: 11 }, { y: 65 }, { x: "30" }, { word: "x".repeat(41) }, { content: "x".repeat(3001) }, { color: "url(javascript:bad)" }]) expect(archerBalloonSchema.safeParse({ ...balloon, ...invalid }).success).toBe(false);
    for (const balloons of [[], Array(13).fill(balloon), [balloon, balloon]]) expect(balloonArcherBlockSchema.safeParse({ ...block, data: { ...block.data, balloons } }).success).toBe(false);
    expect(archerBalloonSchema.safeParse({ ...balloon, word: "", content: "", x: 12.5 }).success).toBe(true);
    expect(archerBalloonPosition({ x: -50, y: 900 })).toEqual({ x: 8, y: 64 });
  });
  it("launches opposite the pull, gives stronger pulls more speed, and applies gravity consistently", () => {
    expect(launchArcherArrow({ x: 0, y: 5 })).toBeNull();
    const weak = launchArcherArrow({ x: 20, y: 40 })!, strong = launchArcherArrow({ x: 20, y: 90 })!;
    expect(strong.vx).toBeLessThan(0); expect(strong.vy).toBeLessThan(weak.vy);
    const single = advanceArcherShot(strong, 0.4), divided = advanceArcherShot(advanceArcherShot(strong, 0.2), 0.2);
    expect(single.x).toBeCloseTo(divided.x); expect(single.y).toBeCloseTo(divided.y); expect(single.vy).toBeCloseTo(divided.vy);
    expect(constrainPull({ x: 999, y: -40 })).toEqual({ x: 110, y: 0 });
    expect(Math.hypot(...Object.values(archerStringRecoil({ x: 30, y: 90 }, 1)))).toBeLessThan(0.01);
  });
  it("detects the first crossed balloon rather than skipping through it at high speed", () => {
    const near = { ...make().data.balloons[0], id: "near", x: 50, y: 50 }, far = { ...near, id: "far", y: 20 };
    expect(firstArcherHit({ x: 400, y: 490 }, { x: 400, y: 10 }, [far, near])?.id).toBe("near");
    expect(firstArcherHit({ x: 10, y: 490 }, { x: 10, y: 10 }, [near])).toBeNull();
    expect(firstArcherHit({ x: 400, y: 300 }, { x: 400, y: 300 }, [near])?.id).toBe("near");
  });
  it("uses scoped per-balloon progress for required activities, optional blocks, and duplication", () => {
    const block = make(), ids = getInteractiveBlockProgressIds(block);
    expect(ids).toEqual(block.data.balloons.map((item) => `archer:balloon:${item.id}`));
    expect(getPendingInteractiveProgressIds([block], new Set([ids[0]]))).toHaveLength(2);
    expect(getRestrictedLessonProgress(100, [block], new Set(ids))).toBe(100);
    expect(getPendingInteractiveProgressIds([{ ...block, requiredForProgress: false }], new Set())).toEqual([]);
    expect(getInteractiveBlockProgressIds(duplicateLessonBlocks([block], () => "copy")[0])[0]).toBe("copy:balloon:explore");
  });
  it.each(["standard", "slides"] as const)("round trips %s and nested popup games through the shared export snapshot", (courseLayout) => {
    const block = make();
    const popup = interactionButtonBlockSchema.parse({ id: "button", version: 1, type: "interactionButton", data: { popup: { blocks: [block] } } });
    const snapshot = editorSnapshotSchema.parse({ title: "Course", description: "", revision: 1, courseLayout, sections: [{ id: "section", title: "Games", order: 0 }], lessons: [{ id: "lesson", sectionId: "section", title: "Play", order: 0, blocks: [block, popup] }] });
    expect(parseScorm12Snapshot(JSON.parse(JSON.stringify(snapshot)))).toEqual(snapshot);
  });
});
