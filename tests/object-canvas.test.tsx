import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createLearningBlock, learningPageSchema, objectPlacementSchema, type LearningPage } from "../lib/slides/blocks";
import { defaultObjectPlacement, materializeObjectCanvas, moveCanvasObject, resizeCanvasObject, setCanvasObjectOrder } from "../lib/slides/object-canvas";
import { createObjectLayout } from "../lib/slides/object-layouts";
import { slideTemplateIds } from "../lib/slides/template-definitions";
import { defaultSlideTheme } from "../lib/slides/themes";
import { LearningPageSurface } from "../components/slides/learning-page-surface";

describe("free prebuilt objects on a fixed canvas", () => {
  it.each(slideTemplateIds)("inserts %s as independent valid editable objects", (id) => {
    const layers = createObjectLayout(id);
    expect(layers.length).toBeGreaterThan(0); expect(layers.some((block) => block.kind === "template")).toBe(false);
    expect(layers.every((block) => block.placement)).toBe(true);
    expect(learningPageSchema.safeParse({ duration: 30, layout: "canvas", layers }).success).toBe(true);
  });
  it("materializes stable positions and preserves object content and timeline values", () => {
    const layer = { ...createLearningBlock("tabs"), start: 3, end: 20 };
    const page = materializeObjectCanvas({ duration: 30, layers: [layer] });
    expect(page.layers[0]).toMatchObject({ ...layer, placement: defaultObjectPlacement("tabs", 0) });
    expect(layer).not.toHaveProperty("placement");
    expect(materializeObjectCanvas(page).layers[0].placement).toEqual(page.layers[0].placement);
  });
  it("constrains moving/resizing to the canvas without changing unrelated properties", () => {
    const position = defaultObjectPlacement("text");
    expect(moveCanvasObject(position, -100, 900)).toMatchObject({ x: 0, y: 420, width: 600, height: 300 });
    expect(resizeCanvasObject(position, 5000, -10)).toMatchObject({ width: 1200, height: 24, x: 80, y: 120 });
    expect(objectPlacementSchema.safeParse({ ...position, x: 1200 }).success).toBe(false);
    expect(objectPlacementSchema.safeParse({ ...position, script: "alert(1)" }).success).toBe(false);
  });
  it("changes stacking independently of placement and timeline timing", () => {
    const page = materializeObjectCanvas({ duration: 30, layers: [createLearningBlock("text"), createLearningBlock("video")] });
    const first = page.layers[0], second = page.layers[1];
    const changed = setCanvasObjectOrder(page, first.id, 1);
    expect(changed.layers.map((layer) => layer.id)).toEqual([second.id, first.id]);
    const after = changed.layers[1];
    expect(after.start).toBe(first.start); expect(after.end).toBe(first.end);
    expect(after.placement).toMatchObject({ x: first.placement!.x, y: first.placement!.y, width: first.placement!.width, height: first.placement!.height, zIndex: 2 });
  });
  it("hiding a timed object leaves another object's position unchanged", () => {
    const page: LearningPage = materializeObjectCanvas({ duration: 30, layers: [{ ...createLearningBlock("text"), end: 3 }, { ...createLearningBlock("image"), src: "", alt: "" } as never] });
    const before = renderToStaticMarkup(<LearningPageSurface page={page} theme={defaultSlideTheme} time={0} />);
    const after = renderToStaticMarkup(<LearningPageSurface page={page} theme={defaultSlideTheme} time={5} />);
    expect(before).toContain("left:780px;top:160px"); expect(after).toContain("left:780px;top:160px");
    expect(before).toContain(page.layers[0].id); expect(after).not.toContain(page.layers[0].id);
  });
  it("uses a true fixed HD/Full HD canvas and allows vector shapes and interactive buttons", () => {
    const page = materializeObjectCanvas({ duration: 30, resolution: "fullHd", layers: [createLearningBlock("shape"), createLearningBlock("button")] });
    const markup = renderToStaticMarkup(<LearningPageSurface page={page} theme={defaultSlideTheme} />);
    expect(markup).toContain("width:1920px;height:1080px"); expect(markup).toContain("position:absolute"); expect(markup).toContain("<svg"); expect(markup).toContain("Continue");
  });
});
