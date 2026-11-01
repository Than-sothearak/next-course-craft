import { describe, expect, it } from "vitest";
import { blockSchema, peelToRevealBlockSchema } from "@/lib/schemas/block";
import { peelSettingsSchema } from "@/lib/schemas/peel-to-reveal";
import { localInteractionPoint, peelDragProgress, peelGeometry } from "@/lib/interactive/physics/peel-geometry";
import { resistDrag, stepSpring, PhysicsInteraction, type InteractionPhase } from "@/lib/interactive/physics/engine";
import { duplicateLessonBlocks } from "@/lib/editor/course-content";
import { getInteractiveBlockProgressIds, getPendingInteractiveProgressIds, getRestrictedLessonProgress } from "@/lib/export/progress";
import { courseAssetIds, remapCourseAssetUrls } from "@/lib/media/asset-references";
import { blockTemplates } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/block-template-data";
import { createBlocksFromTemplate } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/create-blocks-from-template";

const make = (data = {}) => peelToRevealBlockSchema.parse({ id: "peel", type: "peelToReveal", version: 1, data });
function rig(overrides = {}, reduced = false) {
  const frames = new Map<number, (time: number) => void>(); let id = 0, time = 0, complete = 0; const samples: number[] = [], phases: InteractionPhase[] = [];
  const engine = new PhysicsInteraction(peelSettingsSchema.parse(overrides), { request: (callback) => { frames.set(++id, callback); return id; }, cancel: (frame) => { frames.delete(frame); } }, (value) => samples.push(value), (phase) => phases.push(phase), () => complete++, reduced);
  const advance = (count = 360) => { for (let i = 0; i < count; i++) { time += 1000 / 60; const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach((cb) => cb(time)); } };
  return { engine, frames, samples, phases, advance, completions: () => complete };
}
describe("Peel to Reveal content contracts", () => {
  it("defaults to realistic physics, both triggers and formatted replaceable text", () => {
    expect(make()).toMatchObject({ width: "medium", data: { trigger: "both", physicsPreset: "realistic", animationDuration: 1000, direction: "top-right", blocks: [{ type: "richText", data: { html: expect.stringContaining("<strong>") } }] } });
    expect(blockSchema.parse(make())).toEqual(make());
  });
  it.each([{ dragResistance: -1 }, { damping: 0 }, { springStiffness: 501 }, { peelThreshold: 1 }, { animationDuration: 20 }, { paperColor: "url(x)" }, { cardWidth: 0 }])("rejects invalid settings %j", (data) => expect(() => make(data)).toThrow());
  it("rejects recursive interactions, unsupported types, excessive content and duplicate IDs before recursion", () => {
    expect(() => make({ blocks: [make()] })).toThrow();
    expect(() => make({ blocks: [{ id: "popup", type: "interactionButton", version: 1, data: {} }] })).toThrow();
    expect(() => make({ blocks: [] })).toThrow();
    expect(() => make({ blocks: Array(13).fill(make().data.blocks[0]) })).toThrow();
    expect(() => make({ blocks: [make().data.blocks[0], make().data.blocks[0]] })).toThrow();
    const circular: Record<string, unknown> = { id: "loop", type: "peelToReveal", version: 1 }; circular.data = { blocks: [circular] };
    expect(blockSchema.safeParse(circular).success).toBe(false);
  });
  it("preserves rich formatting and packages nested media through the existing URL remapper", () => {
    const src = `/api/assets/${"a".repeat(24)}/file`;
    const block = make({ blocks: [{ id: "text", type: "richText", version: 1, data: { html: '<p><em>Keep this</em></p>' } }, { id: "image", type: "image", version: 1, data: { src, alt: "Diagram" } }, { id: "video", type: "video", version: 1, data: { src, mimeType: "video/mp4" } }, { id: "audio", type: "audio", version: 1, data: { src, fileName: "Voice" } }] });
    expect(courseAssetIds(block)).toEqual(new Set(["a".repeat(24)]));
    const remapped = remapCourseAssetUrls(block, new Map([["a".repeat(24), "./media/example.mp4"]]));
    expect(JSON.stringify(remapped)).not.toContain("/api/"); expect(JSON.stringify(remapped)).toContain("<em>Keep this</em>");
  });
  it("inserts via the existing picker and duplicates nested IDs without sharing content", () => {
    const template = blockTemplates.find((t) => t.id === "interactive-peel-to-reveal")!;
    expect(template.category).toBe("Interactive"); const created = createBlocksFromTemplate(template, "new")[0]; expect(blockSchema.safeParse(created).success).toBe(true);
    let id = 0; const copy = duplicateLessonBlocks([make()], () => `copy-${++id}`)[0]; expect(copy).toMatchObject({ id: "copy-1", data: { blocks: [{ id: "copy-2" }] } });
    expect(make().data.blocks[0].id).toBe("reveal-text");
  });
  it("uses a stable id, requires completed reveal, and excludes optional reveals from gates", () => {
    const block = make(); expect(getInteractiveBlockProgressIds(block)).toEqual(["peel:revealed"]);
    expect(getPendingInteractiveProgressIds([block], new Set())).toEqual(["peel:revealed"]);
    expect(getRestrictedLessonProgress(100, [block], new Set())).toBe(50);
    expect(getPendingInteractiveProgressIds([block], new Set(["peel:revealed"]))).toEqual([]);
    expect(getRestrictedLessonProgress(100, [{ ...block, requiredForProgress: false }], new Set())).toBe(100);
  });
});
describe("shared physical interaction lifecycle", () => {
  it("springs back below threshold without completion", () => { const r = rig(); r.engine.begin(); r.engine.drag(.3); r.advance(12); expect(r.engine.progress).toBeGreaterThan(0); r.engine.release(); r.advance(); expect(r.engine.phase).toBe("idle"); expect(r.engine.progress).toBe(0); expect(r.completions()).toBe(0); expect(r.frames.size).toBe(0); });
  it("finishes an above-threshold fast drag and emits completion exactly once, including replay", () => { const r = rig(); r.engine.begin(); r.engine.drag(1.1); expect(r.completions()).toBe(0); r.engine.release(); expect(r.engine.phase).toBe("revealing"); expect(r.completions()).toBe(0); r.advance(); expect(r.engine.phase).toBe("revealed"); expect(r.completions()).toBe(1); expect(r.phases).toEqual(["grabbing", "peeling", "released", "revealing", "revealed"]); r.engine.reset(); r.engine.reveal(); r.advance(); expect(r.completions()).toBe(1); });
  it("automatically peels with continuous geometry and inertia rather than replacing content", () => { const r = rig(); r.engine.reveal(); r.advance(10); expect(r.engine.progress).toBeGreaterThan(.05); expect(r.engine.progress).toBeLessThan(1); expect(r.completions()).toBe(0); r.advance(); expect(r.completions()).toBe(1); expect(new Set(r.samples.map((v) => peelGeometry(v).flap)).size).toBeGreaterThan(10); });
  it("cancels a strong drag, interrupts an animation and disposes all frames", () => { const r = rig(); r.engine.begin(); r.engine.drag(1.4); r.engine.release(true); r.advance(); expect(r.completions()).toBe(0); r.engine.reveal(); r.advance(5); r.engine.interrupt(); expect(r.frames.size).toBe(0); r.advance(); expect(r.engine.progress).toBe(0); r.engine.reveal(); r.engine.dispose(); expect(r.frames.size).toBe(0); r.engine.reveal(); r.advance(); expect(r.completions()).toBe(0); });
  it("honors disabled automatic completion and reduced motion", () => { const r = rig({ autoComplete: false }); r.engine.begin(); r.engine.drag(1); r.engine.release(); r.advance(); expect(r.completions()).toBe(0); const reduced = rig({}, true); reduced.engine.reveal(); expect(reduced.engine.phase).toBe("revealed"); expect(reduced.frames.size).toBe(0); expect(reduced.completions()).toBe(1); });
  it("restores completion without awarding another record", () => { const r = rig(); r.engine.reset(true); expect(r.engine.phase).toBe("revealed"); expect(r.engine.begin()).toBe(false); expect(r.completions()).toBe(0); });
  it("keeps spring integration stable and drag resistance bounded", () => { expect(resistDrag(1, .8)).toBeLessThan(resistDrag(1, .1)); expect(resistDrag(500, .8)).toBeLessThanOrEqual(1); let x = 0, v = 0; for (let i = 0; i < 300; i++) { const next = stepSpring(x, v, 1, 1 / 60, 180, 24); x = next.position; v = next.velocity; } expect(x).toBeCloseTo(1, 6); });
});
describe("peel geometry and scaled gestures", () => {
  it("uses displayed bounds so a zoomed slide and ordinary card have identical coordinates", () => { expect(localInteractionPoint({ x: 350, y: 160 }, { left: 50, top: 40, width: 400, height: 240 })).toEqual({ x: .75, y: .5 }); expect(localInteractionPoint({ x: 650, y: 280 }, { left: 50, top: 40, width: 800, height: 480 })).toEqual({ x: .75, y: .5 }); });
  it.each(["top-right", "top-left", "bottom-right", "bottom-left"] as const)("peels inward from %s", (direction) => { const start = { x: direction.endsWith("right") ? 1 : 0, y: direction.startsWith("bottom") ? 1 : 0 }; expect(peelDragProgress(start, { x: .5, y: .5 }, direction)).toBeGreaterThan(.8); expect(peelDragProgress({ x: .5, y: .5 }, start, direction)).toBe(0); });
  it("continuously changes the clipped front, curved backside, crease and shadow without invalid coordinates", () => { const initial = peelGeometry(0), middle = peelGeometry(.4), final = peelGeometry(1); expect(initial.front).not.toBe(middle.front); expect(middle.flap).toContain("Q"); expect(middle.crease).toContain("Q"); expect(middle.curl).toBeGreaterThan(initial.curl); expect(final.front).toBe("M0,0 Z"); for (let i = 0; i <= 100; i++) expect(JSON.stringify(peelGeometry(i / 100))).not.toMatch(/NaN|Infinity/); });
});
