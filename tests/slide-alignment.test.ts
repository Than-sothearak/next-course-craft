import { describe, expect, it } from "vitest";
import { alignSlideObjectFrame, snapSlideObjectFrame, slideObjectBounds, type SlideAlignment } from "@/lib/editor/slide-alignment";
import { slideAudioFrameSchema, slideFrameSchema, type SlideFrame } from "@/lib/editor/slide-design";

const area = { width: 960, height: 540 };
const frame: SlideFrame = { x: 25, y: 30, width: 20, height: 20, z: 7 };
const lines = { headerBottom: 20, footerTop: 90 };

describe("presentation object alignment and snapping", () => {
  it.each([
    ["left", { x: 0 }], ["center", { x: 40 }], ["right", { x: 80 }],
    ["top", { y: 0 }], ["middle", { y: 40 }], ["bottom", { y: 80 }],
    ["header", { y: 20 }], ["footer", { y: 70 }],
  ] as const)("aligns to %s without changing object dimensions or layer", (alignment, expected) => {
    expect(alignSlideObjectFrame(frame, alignment, area, lines)).toEqual({ ...frame, ...expected });
  });

  it("aligns compact audio to the canvas bottom without changing its height", () => {
    const compact = { ...frame, height: .5 };
    const result = alignSlideObjectFrame(compact, "bottom", area);
    expect(result).toEqual({ ...compact, y: 99.5 });
    expect(slideAudioFrameSchema.safeParse(result).success).toBe(true);
    expect(alignSlideObjectFrame(frame, "footer", area, { footerTop: 100 }).y).toBe(80);
    expect(alignSlideObjectFrame(frame, "header", area)).toEqual(frame);
  });

  it.each([.25, .5, 1, 1.5, 2])("snaps within eight screen pixels at %sx zoom and leaves farther objects alone", (zoom) => {
    const displayed = { width: area.width * zoom, height: area.height * zoom };
    for (const [alignment, near] of [
      ["left", { x: 7 / displayed.width * 100 }],
      ["right", { x: 80 - 7 / displayed.width * 100 }],
      ["center", { x: 40 + 7 / displayed.width * 100 }],
      ["top", { y: 7 / displayed.height * 100 }],
      ["bottom", { y: 80 - 3 / displayed.height * 100 }],
      ["middle", { y: 40 + 7 / displayed.height * 100 }],
      ["header", { y: 20 + 7 / displayed.height * 100 }],
      ["footer", { y: 70 - 7 / displayed.height * 100 }],
    ] as [SlideAlignment, Partial<SlideFrame>][]) {
      const snap = snapSlideObjectFrame({ ...frame, ...near }, area, displayed, lines);
      expect(snap.guides.some((guide) => guide.id === alignment)).toBe(true);
      expect(snap.frame.x).toBeCloseTo(alignSlideObjectFrame(frame, alignment, area, lines).x);
      expect(snap.frame.y).toBeCloseTo(alignSlideObjectFrame(frame, alignment, area, lines).y);
      expect(slideFrameSchema.safeParse(snap.frame).success).toBe(true);
    }
    const far = { ...frame, x: 9 / displayed.width * 100 };
    expect(snapSlideObjectFrame(far, area, displayed, lines).guides.some((guide) => guide.id === "left")).toBe(false);
  });

  it("snaps both axes together and uses the closest target on each axis", () => {
    const snap = snapSlideObjectFrame({ ...frame, x: .5, y: 20.5 }, area, area, lines);
    expect(snap.frame).toEqual({ ...frame, x: 0, y: 20 });
    expect(snap.guides.map((guide) => guide.id)).toEqual(["left", "header"]);
    const nearLines = { headerBottom: 40.5, footerTop: 90 };
    const close = snapSlideObjectFrame({ ...frame, y: 40.4 }, area, area, nearLines);
    expect(close.guides.find((guide) => guide.axis === "y")?.id).toBe("header");
  });

  it("aligns the actual rotated bounds where they fit and preserves rotation", () => {
    for (const rotation of [15, 30, 45, 330]) for (const alignment of ["left", "right", "top", "bottom", "header", "footer"] as const) {
      const rotated = { ...frame, rotation };
      const result = alignSlideObjectFrame(rotated, alignment, area, lines);
      const bounds = slideObjectBounds(result, area);
      const value = alignment === "header" ? bounds.top : alignment === "footer" ? bounds.bottom : bounds[alignment];
      const expected = alignment === "left" || alignment === "top" ? 0 : alignment === "right" || alignment === "bottom" ? 100 : alignment === "header" ? 20 : 90;
      expect(value).toBeCloseTo(expected, 7);
      expect(result).toMatchObject({ width: frame.width, height: frame.height, rotation, z: frame.z });
      expect(slideFrameSchema.safeParse(result).success).toBe(true);
    }
  });

  it("does not show impossible rotated edge guides or snap before a canvas is measured", () => {
    const rotated = { ...frame, x: 0, rotation: 90 };
    const result = snapSlideObjectFrame(rotated, area, { width: 240, height: 135 }, lines, 30);
    expect(result.guides.some((guide) => guide.id === "left")).toBe(false);
    expect(snapSlideObjectFrame(frame, area, { width: 0, height: 0 }, lines)).toEqual({ frame, guides: [] });
    expect(snapSlideObjectFrame({ ...frame, x: .2, y: .2 }, area, area).guides.map((guide) => guide.id)).toEqual(["left", "top"]);
  });
});
