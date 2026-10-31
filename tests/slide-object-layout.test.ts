import { describe, expect, it } from "vitest";
import { blockSchema } from "@/lib/schemas/block";
import { fitSlideMediaFrame, fitSlideTextFrame, resolveSlideFrame, slideFrameSchema, slideObjectArea, slideTextLayoutSchema } from "@/lib/editor/slide-design";
import { resizeSlideObjectFrame, resolveSlideMedia, snapSlideFrameToFooter } from "@/lib/editor/slide-objects";
import { remapCourseAssetUrls } from "@/lib/media/asset-references";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { parseScorm12Snapshot } from "@/lib/scorm12/snapshot";

const frame = { x: 11, y: 8, width: 50, height: 55, z: 2 };
const source = "/api/assets/507f1f77bcf86cd799439011/file";
function image(width: number, height: number) {
  return blockSchema.parse({ id: "image", version: 1, type: "image", slideFrame: frame, slideMedia: { source, width, height }, data: { src: source, alt: "Example" } });
}
function physicalRatio(value: typeof frame) {
  return value.width * slideObjectArea.width / (value.height * slideObjectArea.height);
}

describe("presentation text alignment and media sizing", () => {
  it("snaps frames of every height without changing their size or layer, at every zoom", () => {
    for (const height of [5, 24, 55, 80, 100]) for (const zoom of [0.5, 1, 2]) {
      const displayedHeight = slideObjectArea.height * zoom;
      const near = { ...frame, height, y: Math.max(0, 100 - height - 7 / displayedHeight * 100) };
      const snap = snapSlideFrameToFooter(near, displayedHeight);
      expect(snap).toEqual({ frame: { ...near, y: 100 - height }, snapped: true });
      expect(slideFrameSchema.safeParse(snap.frame).success).toBe(true);
      if (height < 100) expect(snapSlideFrameToFooter({ ...near, y: 100 - height - 9 / displayedHeight * 100 }, displayedHeight).snapped).toBe(false);
    }
    expect(snapSlideFrameToFooter(frame, 0).snapped).toBe(false);
  });
  it.each([[1920, 1080], [1080, 1920], [800, 800], [2400, 600]])("fits %d × %d media at its intrinsic aspect ratio", (width, height) => {
    const block = image(width, height);
    const fitted = fitSlideMediaFrame(frame, { width, height }, { width: frame.width });
    expect(slideFrameSchema.safeParse(fitted).success).toBe(true);
    expect(physicalRatio(fitted)).toBeCloseTo(width / height, 8);
    for (const update of [{ width: 25 }, { height: 60 }, { width: 200 }, { height: 200 }, { width: 1 }]) {
      const resized = resizeSlideObjectFrame(block, fitted, update);
      expect(slideFrameSchema.safeParse(resized).success).toBe(true);
      expect(physicalRatio(resized)).toBeCloseTo(width / height, 8);
      expect(resized.z).toBe(frame.z);
    }
  });

  it("stays in the canvas near its edges and handles extreme aspect ratios", () => {
    for (const [width, height] of [[100_000, 1], [1, 100_000], [1920, 1080], [1080, 1920]]) {
      const value = fitSlideMediaFrame({ ...frame, x: 95, y: 95, width: 5, height: 5 }, { width, height }, { width: 100 });
      expect(slideFrameSchema.safeParse(value).success).toBe(true);
    }
    expect(fitSlideMediaFrame(frame, { width: 0, height: 100 }, { width: 20 })).toEqual(frame);
  });

  it("keeps the natural media ratio when opening saved frames from the older object region", () => {
    const block = image(320, 640);
    const resolved = resolveSlideFrame(block, 0, 1);
    expect(physicalRatio(resolved)).toBeCloseTo(0.5, 8);
    expect(resolved.x).toBe(frame.x); expect(resolved.y).toBe(frame.y);
  });

  it("defaults text boxes to zero padding and fits measured content", () => {
    expect(slideTextLayoutSchema.parse({})).toMatchObject({ paddingX: 0, paddingY: 0, fitToText: true });
    const fitted = fitSlideTextFrame(frame, { width: 240, height: 48 }, slideObjectArea);
    expect(fitted).toEqual({ ...frame, width: 25, height: expect.closeTo(48 / slideObjectArea.height * 100, 8) });
    expect(slideFrameSchema.safeParse(fitted).success).toBe(true);
  });

  it("ignores dimensions for a replaced source and remaps media metadata for offline output", () => {
    const block = image(1920, 1080);
    if (block.type !== "image") throw new Error("Expected image");
    expect(resolveSlideMedia({ ...block, data: { ...block.data, src: "/replacement.png" } })).toBeUndefined();
    const offline = remapCourseAssetUrls(block, new Map([["507f1f77bcf86cd799439011", "./media/photo.png"]]));
    expect(resolveSlideMedia(offline)).toEqual({ source: "./media/photo.png", width: 1920, height: 1080 });
  });

  it("validates alignment and dimensions and retains them in editor and SCORM snapshots", () => {
    const block = { ...image(1920, 1080), slideTextLayout: { horizontal: "center", vertical: "middle" } };
    const snapshot = editorSnapshotSchema.parse({ title: "Presentation", description: "", courseLayout: "slides", revision: 1,
      sections: [{ id: "section", title: "Slides", order: 0 }],
      lessons: [{ id: "slide", sectionId: "section", title: "Slide 1", order: 0, blocks: [block] }],
    });
    expect(parseScorm12Snapshot(snapshot).lessons[0].blocks[0]).toMatchObject(block);
    expect(blockSchema.safeParse({ ...block, slideTextLayout: { horizontal: "outside", vertical: "middle" } }).success).toBe(false);
    expect(blockSchema.safeParse({ ...block, slideTextLayout: { horizontal: "center", vertical: "outside" } }).success).toBe(false);
    expect(blockSchema.safeParse({ ...block, slideMedia: { source, width: Infinity, height: 100 } }).success).toBe(false);
    expect(blockSchema.safeParse({ ...block, slideMedia: { source, width: 100, height: 0 } }).success).toBe(false);
  });
});
