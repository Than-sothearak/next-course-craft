import { describe, expect, it } from "vitest";
import { fitGraphicImage, graphicImageFitSchema, projectGraphicPoint, unprojectGraphicPoint } from "@/lib/editor/graphic-layout";

const frame = { width: 600, height: 300 };
const image = { width: 100, height: 100 };

describe("interactive image fit geometry", () => {
  it.each([
    ["fill", { left: 0, top: 0, width: 600, height: 300 }],
    ["contain", { left: 150, top: 0, width: 300, height: 300 }],
    ["cover", { left: 0, top: -150, width: 600, height: 600 }],
    ["none", { left: 250, top: 100, width: 100, height: 100 }],
    ["scale-down", { left: 250, top: 100, width: 100, height: 100 }],
  ] as const)("matches CSS %s fitting", (fit, expected) => {
    const rect = fitGraphicImage(frame, image, fit);
    expect(rect).toEqual(expected);
    const point = { x: 20, y: 30 };
    const projected = projectGraphicPoint(point, frame, rect);
    const restored = unprojectGraphicPoint(projected, frame, rect);
    expect(restored.x).toBeCloseTo(point.x, 10);
    expect(restored.y).toBeCloseTo(point.y, 10);
    expect(point).toEqual({ x: 20, y: 30 });
  });

  it("scales down large sources but never enlarges small sources", () => {
    expect(fitGraphicImage(frame, { width: 1200, height: 600 }, "scale-down")).toEqual({ left: 0, top: 0, width: 600, height: 300 });
    expect(fitGraphicImage(frame, image, "scale-down")).toEqual(fitGraphicImage(frame, image, "none"));
  });

  it("projects points into letterboxed and cropped image coordinates", () => {
    expect(projectGraphicPoint({ x: 20, y: 30 }, frame, fitGraphicImage(frame, image, "contain"))).toEqual({ x: 35, y: 30 });
    expect(projectGraphicPoint({ x: 20, y: 30 }, frame, fitGraphicImage(frame, image, "cover"))).toEqual({ x: 20, y: 10 });
  });

  it("waits for image dimensions and rejects unknown fit modes", () => {
    expect(fitGraphicImage(frame, { width: 0, height: 0 }, "contain")).toEqual({ left: 0, top: 0, ...frame });
    expect(graphicImageFitSchema.safeParse("stretch-random").success).toBe(false);
  });
});
