import { describe, expect, it } from "vitest";
import { blockSchema } from "@/lib/schemas/block";
import { fitSlideFrame, fitSlideMediaFrame, fitSlideTextFrame, slideAudioFrameSchema, slideFrameSchema, type SlideFrame } from "@/lib/editor/slide-design";
import { normalizeSlideRotation, resizeSlideFrameFromHandle, rotateSlideFrame, slideResizeHandles } from "@/lib/editor/slide-transform";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { parseScorm12Snapshot } from "@/lib/scorm12/snapshot";

const area = { width: 960, height: 540 };
const frame: SlideFrame = { x: 25, y: 25, width: 30, height: 30, z: 2 };
const heading = blockSchema.parse({ id: "heading", version: 1, type: "heading", data: { text: "Heading", level: 2 }, slideFrame: frame });

// Compute the opposite point in canvas pixels, independently of the resize code.
function anchor(value: SlideFrame, x: number, y: number) {
  const radians = (value.rotation ?? 0) * Math.PI / 180;
  const width = value.width / 100 * area.width, height = value.height / 100 * area.height;
  return {
    x: (value.x + value.width / 2) / 100 * area.width - x * width / 2 * Math.cos(radians) + y * height / 2 * Math.sin(radians),
    y: (value.y + value.height / 2) / 100 * area.height - x * width / 2 * Math.sin(radians) - y * height / 2 * Math.cos(radians),
  };
}

describe("presentation object transforms", () => {
  it.each(slideResizeHandles)("resizes from $id while fixing the opposite point at every rotation", (handle) => {
    for (const rotation of [0, 30, 90, 210, 359]) {
      const initial = { ...frame, rotation };
      const result = resizeSlideFrameFromHandle(heading, initial, handle.id, { x: 24, y: 18 }, area);
      expect(slideFrameSchema.safeParse(result).success).toBe(true);
      expect(result).toMatchObject({ rotation, z: frame.z });
      const before = anchor(initial, handle.x, handle.y), after = anchor(result, handle.x, handle.y);
      expect(after.x).toBeCloseTo(before.x, 7);
      expect(after.y).toBeCloseTo(before.y, 7);
      expect(result).not.toEqual(initial);
    }
  });

  it("changes only the edge being dragged before rotation and uses rotated local axes afterward", () => {
    expect(resizeSlideFrameFromHandle(heading, frame, "left", { x: 48, y: 100 }, area)).toEqual({ ...frame, x: 30, width: 25 });
    expect(resizeSlideFrameFromHandle(heading, frame, "top", { x: 200, y: 27 }, area)).toEqual({ ...frame, y: 30, height: 25 });
    const rotated = resizeSlideFrameFromHandle(heading, { ...frame, rotation: 90 }, "right", { x: 0, y: 48 }, area);
    expect(rotated.width).toBe(35);
    expect(rotated.height).toBe(frame.height);
  });

  it.each(slideResizeHandles)("bounds $id resizing without flipping, escaping the canvas or moving its anchor", (handle) => {
    for (const rotation of [0, 45, 90]) for (const delta of [-10_000, 10_000]) {
      const initial = { ...frame, rotation };
      const result = resizeSlideFrameFromHandle(heading, initial, handle.id, { x: delta, y: delta }, area);
      expect(slideFrameSchema.safeParse(result).success).toBe(true);
      const before = anchor(initial, handle.x, handle.y), after = anchor(result, handle.x, handle.y);
      expect(after.x).toBeCloseTo(before.x, 6);
      expect(after.y).toBeCloseTo(before.y, 6);
    }
  });

  it("keeps media proportional through all eight handles on rectangular and portrait canvases", () => {
    const image = blockSchema.parse({ id: "image", version: 1, type: "image", data: { src: "/example.png", alt: "" } });
    for (const size of [area, { width: 540, height: 960 }]) for (const handle of slideResizeHandles) {
      const initial = fitSlideMediaFrame({ ...frame, rotation: 30 }, { width: 1600, height: 900 }, { width: 30 }, size);
      for (const delta of [-10_000, -24, 24, 10_000]) {
        const result = resizeSlideFrameFromHandle(image, initial, handle.id, { x: delta, y: delta }, size);
        expect(slideFrameSchema.safeParse(result).success).toBe(true);
        expect(result.width * size.width / (result.height * size.height)).toBeCloseTo(16 / 9, 7);
      }
    }
  });

  it("keeps compact audio valid and retains rotation through movement, text fitting and media fitting", () => {
    const audio = blockSchema.parse({ id: "audio", version: 1, type: "audio", data: { src: "" } });
    const compact = resizeSlideFrameFromHandle(audio, { ...frame, rotation: 0 }, "top", { x: 0, y: 10_000 }, area);
    expect(compact.height).toBe(.5);
    expect(slideAudioFrameSchema.safeParse(compact).success).toBe(true);
    const rotated = { ...frame, rotation: 125 };
    expect(fitSlideFrame(rotated, { x: 12 }).rotation).toBe(125);
    expect(fitSlideTextFrame(rotated, { width: 240, height: 60 }, area).rotation).toBe(125);
    expect(fitSlideMediaFrame(rotated, { width: 1600, height: 900 }, { width: 20 }, area).rotation).toBe(125);
  });

  it("wraps rotation around zero and snaps to 15 degree steps when requested", () => {
    expect(normalizeSlideRotation(-15)).toBe(345);
    expect(normalizeSlideRotation(720)).toBe(0);
    expect(rotateSlideFrame({ ...frame, rotation: 350 }, 0, Math.PI / 6).rotation).toBe(20);
    expect(rotateSlideFrame(frame, Math.PI * .95, -Math.PI * .95).rotation).toBe(18);
    expect(rotateSlideFrame(frame, 0, 22 * Math.PI / 180, true).rotation).toBe(15);
  });

  it("validates rotation in course and nested popup snapshots and retains it in offline data", () => {
    const rotated = { ...heading, slideFrame: { ...frame, rotation: 42 } };
    const popup = blockSchema.parse({ id: "popup", type: "interactionButton", version: 1, data: { popup: { blocks: [rotated] } } });
    const snapshot = editorSnapshotSchema.parse({ title: "Presentation", description: "", revision: 1, courseLayout: "slides",
      sections: [{ id: "section", title: "Slides", order: 0 }],
      lessons: [{ id: "slide", sectionId: "section", title: "Slide 1", order: 0, blocks: [rotated, popup] }],
    });
    expect(parseScorm12Snapshot(snapshot).lessons[0].blocks).toEqual(snapshot.lessons[0].blocks);
    expect(snapshot.lessons[0].blocks[0].slideFrame?.rotation).toBe(42);
    const nested = snapshot.lessons[0].blocks[1];
    expect(nested.type === "interactionButton" && nested.data.popup.blocks[0].slideFrame?.rotation).toBe(42);
    for (const rotation of [-1, 361, NaN, Infinity, "45", "rotate(45deg)"]) {
      expect(blockSchema.safeParse({ ...rotated, slideFrame: { ...frame, rotation } }).success).toBe(false);
    }
    expect(slideFrameSchema.parse(frame)).not.toHaveProperty("rotation");
  });
});
