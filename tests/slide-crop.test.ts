import { describe, expect, it } from "vitest";
import { cropRectSchema, croppedDimensions, cropToAspect, fullCrop, moveCrop, resizeCrop, resolveSlideCrop } from "@/lib/editor/slide-crop";
import { blockSchema } from "@/lib/schemas/block";
import { resizeSlideObjectFrame } from "@/lib/editor/slide-objects";
import { resolveSlideFrame, slideObjectArea } from "@/lib/editor/slide-design";
import { remapCourseAssetUrls } from "@/lib/media/asset-references";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { parseScorm12Snapshot } from "@/lib/scorm12/snapshot";

const source = "/api/assets/507f1f77bcf86cd799439011/file";
const rect = { x: 25, y: 10, width: 50, height: 80 };
describe("presentation media crops", () => {
  it("rejects empty, nonfinite and out-of-bounds rectangles", () => {
    for (const crop of [{ ...rect, width: 0 }, { ...rect, x: -1 }, { ...rect, y: 99 }, { ...rect, height: Infinity }, { ...rect, x: NaN }]) expect(cropRectSchema.safeParse(crop).success).toBe(false);
    expect(cropRectSchema.parse(fullCrop)).toEqual(fullCrop);
  });
  it("moves the crop inside the source and keeps its dimensions", () => {
    expect(moveCrop(rect, 999, -999)).toEqual({ ...rect, x: 50, y: 0 });
  });
  it.each(["top-left", "top-right", "bottom-left", "bottom-right"] as const)("resizes %s while retaining the opposite corner and bounds", (corner) => {
    for (const delta of [-200, -5, 5, 200]) {
      const crop = resizeCrop(rect, corner, delta, delta);
      expect(cropRectSchema.safeParse(crop).success).toBe(true);
      expect(corner.endsWith("right") ? crop.x : crop.x + crop.width).toBeCloseTo(corner.endsWith("right") ? rect.x : rect.x + rect.width);
      expect(corner.startsWith("bottom") ? crop.y : crop.y + crop.height).toBeCloseTo(corner.startsWith("bottom") ? rect.y : rect.y + rect.height);
    }
  });
  it("fits an aspect preset in source pixels and retains its ratio while resizing", () => {
    const square = cropToAspect(fullCrop, { width: 1920, height: 1080 }, 1);
    expect(square).toEqual({ x: 21.875, y: 0, width: 56.25, height: 100 });
    const resized = resizeCrop(square, "bottom-right", -10, -10, 1080 / 1920);
    const size = croppedDimensions({ width: 1920, height: 1080 }, resized);
    expect(size.width / size.height).toBeCloseTo(1); expect(cropRectSchema.safeParse(resized).success).toBe(true);
  });
  it.each(["image", "video"])("preserves crop proportions through resizing, source replacement and offline packaging (%s)", (type) => {
    const block = blockSchema.parse({ id: "media", version: 1, type, data: { src: source, alt: "Photo", mimeType: type === "video" ? "video/mp4" : undefined }, slideMedia: { source, width: 1920, height: 1080 }, slideCrop: { source, ...rect }, slideFrame: { x: 5, y: 5, width: 40, height: 40, z: 0 } });
    const frame = resolveSlideFrame(block, 0, 1);
    const resized = resizeSlideObjectFrame(block, frame, { width: 60 });
    for (const value of [frame, resized]) expect(value.width * slideObjectArea.width / (value.height * slideObjectArea.height)).toBeCloseTo((1920 * 0.5) / (1080 * 0.8));
    if (block.type !== "image" && block.type !== "video") throw new Error("Expected media");
    expect(resolveSlideCrop({ ...block, data: { ...block.data, src: "/replacement" } })).toBeUndefined();
    const snapshot = editorSnapshotSchema.parse({ title: "Cropped presentation", description: "", revision: 1, courseLayout: "slides", sections: [{ id: "section", title: "Slides", order: 0 }], lessons: [{ id: "slide", sectionId: "section", title: "Media", order: 0, blocks: [block] }] });
    const offline = remapCourseAssetUrls(parseScorm12Snapshot(snapshot), new Map([["507f1f77bcf86cd799439011", "./media/original.mp4"]])).lessons[0].blocks[0];
    expect(offline.slideCrop).toEqual({ source: "./media/original.mp4", ...rect }); expect(offline.slideMedia?.source).toBe("./media/original.mp4");
  });
});
