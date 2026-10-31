/** @vitest-environment jsdom */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { blockSchema } from "../lib/schemas/block";
import { PreviewBlock } from "../app/courses/[courseId]/preview/_components/(course_preview_components)/(lesson_reader_preview_components)/(lesson_blocks_preview_components)/preview-block";
import { CoursePreview, type PreviewData } from "../app/courses/[courseId]/preview/course-preview";
import { InteractiveLabeledGraphic } from "../app/courses/[courseId]/preview/interactive-blocks";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const graphic = blockSchema.parse({
  id: "graphic", version: 1, type: "labeledGraphic",
  data: {
    src: "/diagram.png", alt: "System diagram", markerColor: "#123456", textColor: "#fef3c7", radarColor: "#f97316",
    markers: [
      { id: "input", label: "Input", description: "Information enters here.", x: 20, y: 30 },
      { id: "output", label: "Output", description: "The result appears here.", x: 80, y: 70 },
    ],
  },
});
if (graphic.type !== "labeledGraphic") throw new Error("Expected graphic fixture");

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("presentation graphic sizing and popups", () => {
  let displayScale: number;
  let frameWidth: number;
  let frameHeight: number;
  beforeEach(() => {
    displayScale = 0.5;
    frameWidth = 600;
    frameHeight = 300;
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(function (this: HTMLElement) {
      if (this.getAttribute("role") === "group" || this.getAttribute("data-testid") === "labeled-graphic-canvas") return frameWidth;
      return 0;
    });
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(function (this: HTMLElement) {
      if (this.getAttribute("role") === "group" || this.getAttribute("data-testid") === "labeled-graphic-canvas") return frameHeight;
      return 0;
    });
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(function (this: HTMLElement) { return this.classList.contains("labeled-graphic-popover") ? 180 : 0; });
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) { return this.classList.contains("labeled-graphic-popover") ? 80 : 0; });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const width = (this.offsetWidth || this.clientWidth) * displayScale;
      const height = (this.offsetHeight || this.clientHeight) * displayScale;
      return { x: 50, y: 30, left: 50, top: 30, width, height, right: 50 + width, bottom: 30 + height, toJSON: () => ({}) };
    });
  });

  function renderGraphic(block = graphic) {
    act(() => root.render(createElement(PreviewBlock, { block, slideLayout: true, device: "desktop", orientation: "landscape" })));
  }

  function loadImage(width: number, height: number) {
    const image = container.querySelector("img")!;
    Object.defineProperties(image, { naturalWidth: { configurable: true, value: width }, naturalHeight: { configurable: true, value: height } });
    act(() => image.dispatchEvent(new Event("load")));
  }

  const canvas = () => container.querySelector<HTMLElement>('[data-testid="labeled-graphic-canvas"]')!;
  const popup = () => container.querySelector<HTMLElement>(".labeled-graphic-popover")!;
  const clickMarker = (label: string) => act(() => container.querySelector<HTMLButtonElement>(`[aria-label="${label}: show explanation"]`)!.click());

  it.each([0.5, 1, 1.5, 2])("anchors explanations beside their points at %sx display scale", (scale) => {
    displayScale = scale;
    renderGraphic(); loadImage(1200, 600);
    clickMarker("Input");
    expect(popup().style.left).toBe("132px");
    expect(popup().style.top).toBe("102px");
    clickMarker("Output");
    expect(popup().style.left).toBe("288px");
    expect(popup().style.top).toBe("118px");
    displayScale = scale / 2;
    act(() => window.dispatchEvent(new Event("resize")));
    expect(popup().style.left).toBe("288px");
    expect(popup().style.top).toBe("118px");
  });

  it.each([
    [1200, 600],
    [400, 1200],
    [2000, 200],
  ])("fills the object with a %s by %s image and stays stable when points open", (width, height) => {
    renderGraphic(); loadImage(width, height);
    expect(canvas().style.width).toBe("100%");
    expect(canvas().style.height).toBe("100%");
    for (const label of ["Input", "Output"]) {
      clickMarker(label);
      expect(canvas().style.width).toBe("100%");
      expect(canvas().style.height).toBe("100%");
    }
  });

  it("keeps point coordinates and popup placement aligned after resizing the object", () => {
    renderGraphic({ ...graphic, data: { ...graphic.data, objectFit: "fill" } }); loadImage(400, 1200); clickMarker("Input");
    expect(popup().style.left).toBe("132px"); expect(popup().style.top).toBe("102px");
    frameWidth = 800; frameHeight = 400;
    act(() => window.dispatchEvent(new Event("resize")));
    expect(popup().style.left).toBe("172px"); expect(popup().style.top).toBe("132px");
    const point = container.querySelector<HTMLElement>('[aria-label="Input: show explanation"]')!;
    expect(point.style.left).toBe("20%"); expect(point.style.top).toBe("30%");
  });

  it("defaults presentation images to contain and displays automatic, custom, and text point labels", () => {
    const block = { ...graphic, data: { ...graphic.data, radarSize: 7, radarWeight: 4, markers: [
      { ...graphic.data.markers[0] },
      { ...graphic.data.markers[1], displayMode: "number" as const, displayNumber: 42 },
      { ...graphic.data.markers[1], id: "note", label: "Note", displayMode: "text" as const, displayText: "GO" },
    ] } };
    renderGraphic(block); loadImage(100, 100);
    const points = [...container.querySelectorAll<HTMLButtonElement>('[aria-label$=": show explanation"]')];
    expect(container.querySelector("img")?.style.objectFit).toBe("contain");
    expect(points.map((point) => point.textContent)).toEqual(["1", "42", "GO"]);
    expect(points[0].style.left).toBe("35%");
    expect(points[0].style.getPropertyValue("--radar-size")).toBe("7px");
    expect(points[0].style.getPropertyValue("--radar-weight")).toBe("4px");
    renderGraphic({ ...block, data: { ...block.data, markers: [block.data.markers[0], block.data.markers[2]] } });
    expect([...container.querySelectorAll<HTMLButtonElement>('[aria-label$=": show explanation"]')].map((point) => point.textContent)).toEqual(["1", "GO"]);
  });

  it("rejects out-of-range radar settings and point labels", () => {
    expect(blockSchema.safeParse({ ...graphic, data: { ...graphic.data, radarSize: 25 } }).success).toBe(false);
    expect(blockSchema.safeParse({ ...graphic, data: { ...graphic.data, radarWeight: 0 } }).success).toBe(false);
    expect(blockSchema.safeParse({ ...graphic, data: { ...graphic.data, markers: [{ ...graphic.data.markers[0], displayNumber: 1000 }] } }).success).toBe(false);
    expect(blockSchema.safeParse({ ...graphic, data: { ...graphic.data, markers: [{ ...graphic.data.markers[0], displayText: "A point label that is too long" }] } }).success).toBe(false);
  });

  it.each([
    ["fill", 20, 30], ["contain", 35, 30], ["cover", 20, 10], ["none", 45, 130 / 3], ["scale-down", 45, 130 / 3],
  ] as const)("aligns image hotspots with %s fitting", (objectFit, expectedX, expectedY) => {
    renderGraphic({ ...graphic, data: { ...graphic.data, objectFit } }); loadImage(100, 100);
    const point = container.querySelector<HTMLElement>('[aria-label="Input: show explanation"]')!;
    expect(Number.parseFloat(point.style.left)).toBeCloseTo(expectedX, 8);
    expect(Number.parseFloat(point.style.top)).toBeCloseTo(expectedY, 8);
    expect(container.querySelector("img")?.style.objectFit).toBe(objectFit);
    clickMarker("Input");
    expect(popup().textContent).toContain("Information enters here.");
  });

  it.each([
    ["fill", 52, 52], ["contain", 54, 52], ["cover", 52, 51], ["none", 62, 56], ["scale-down", 62, 56],
  ] as const)("drags points in source-image coordinates with %s fitting", (objectFit, expectedX, expectedY) => {
    const onMarkerPositionChange = vi.fn();
    act(() => root.render(createElement(InteractiveLabeledGraphic, { blockId: "graphic", src: "/diagram.png", alt: "Diagram", markers: graphic.data.markers, presentation: true, editable: true, objectFit, onMarkerPositionChange })));
    loadImage(100, 100);
    const point = container.querySelector<HTMLButtonElement>('[aria-label="Input: show explanation"]')!;
    point.setPointerCapture = vi.fn(); point.releasePointerCapture = vi.fn();
    const pointer = (type: string, clientX: number, clientY: number) => {
      const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX, clientY });
      Object.defineProperty(event, "pointerId", { value: 1 }); return event;
    };
    act(() => point.dispatchEvent(pointer("pointerdown", 100, 80)));
    act(() => point.dispatchEvent(pointer("pointermove", 206, 108)));
    expect(Number.parseFloat(point.style.left)).toBeCloseTo(52, 8);
    expect(Number.parseFloat(point.style.top)).toBeCloseTo(52, 8);
    expect(onMarkerPositionChange).not.toHaveBeenCalled();
    act(() => point.dispatchEvent(pointer("pointerup", 206, 108)));
    expect(onMarkerPositionChange).toHaveBeenCalledOnce();
    expect(onMarkerPositionChange).toHaveBeenCalledWith("input", { x: expectedX, y: expectedY });
  });

  it.each([false, true])("uses the full object coordinate system for map artwork in presentation mode (%s)", (slideLayout) => {
    const block = { ...graphic, data: { ...graphic.data, src: "", mapTemplate: "learningRoad" as const } };
    act(() => root.render(createElement(PreviewBlock, { block, slideLayout, device: "desktop", orientation: "landscape" })));
    expect(container.querySelector('svg[aria-label="Learning Road illustrated lesson map"]')?.getAttribute("preserveAspectRatio")).toBe(slideLayout ? "none" : "xMidYMid slice");
  });

  it.each(["data", "security", "network", "agriculture"] as const)("fills the object with the built-in %s scene", (sceneTheme) => {
    renderGraphic({ ...graphic, data: { ...graphic.data, src: "", sceneTheme } });
    expect(container.querySelector(`svg[data-scene-theme="${sceneTheme}"]`)?.getAttribute("preserveAspectRatio")).toBe("none");
  });

  it.each([[1, 1], [99, 1], [1, 99], [99, 99]])("keeps the popup inside the image for a point at %s%%, %s%%", (x, y) => {
    renderGraphic({ ...graphic, data: { ...graphic.data, markers: [{ ...graphic.data.markers[0], x, y }] } });
    loadImage(1200, 600); clickMarker("Input");
    const left = Number.parseFloat(popup().style.left);
    const top = Number.parseFloat(popup().style.top);
    expect(left).toBeGreaterThanOrEqual(8);
    expect(top).toBeGreaterThanOrEqual(8);
    expect(left + popup().offsetWidth).toBeLessThanOrEqual(canvas().clientWidth - 8);
    expect(top + popup().offsetHeight).toBeLessThanOrEqual(canvas().clientHeight - 8);
  });
});

function expectSavedColors(scope: ParentNode) {
  const markers = scope.querySelectorAll<HTMLButtonElement>(".labeled-graphic-radar");
  expect(markers).toHaveLength(2);
  for (const marker of markers) {
    expect(marker.style.backgroundColor).toBe("rgb(18, 52, 86)");
    expect(marker.style.color).toBe("rgb(254, 243, 199)");
    expect(marker.style.getPropertyValue("--radar-color")).toBe("#f97316");
  }
}

describe("labeled graphic colors in the shared lesson renderer", () => {
  it.each([undefined, true, false])("keeps a point clickable with radar animation set to %s", (radarEnabled) => {
    const block = { ...graphic, data: { ...graphic.data, markers: graphic.data.markers.map((marker, index) => index === 0 ? { ...marker, radarEnabled } : marker) } };
    act(() => root.render(createElement(PreviewBlock, { block, device: "desktop", orientation: "portrait" })));
    const point = container.querySelector<HTMLButtonElement>('[aria-label="Input: show explanation"]')!;
    expect(point.classList.contains("labeled-graphic-radar")).toBe(radarEnabled !== false);
    expect(container.querySelector('[aria-label="Output: show explanation"]')?.classList.contains("labeled-graphic-radar")).toBe(true);
    act(() => point.click());
    expect(container.querySelector(".labeled-graphic-popover")?.textContent).toContain("Information enters here.");
  });

  it.each([
    ["desktop", "portrait"], ["desktop", "landscape"],
    ["tablet", "portrait"], ["tablet", "landscape"],
    ["mobile", "portrait"], ["mobile", "landscape"],
  ] as const)("applies saved colors in %s %s preview and preserves interaction tracking", (device, orientation) => {
    const onInteractiveProgress = vi.fn();
    act(() => root.render(createElement(PreviewBlock, { block: graphic, device, orientation, onInteractiveProgress })));
    expectSavedColors(container);
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Output: show explanation"]')!.click());
    expect(onInteractiveProgress).toHaveBeenCalledWith("graphic:marker:output");
    expect(container.querySelector(".labeled-graphic-popover")?.textContent).toContain("The result appears here.");
    expectSavedColors(container);
  });

  it("uses the point color for the radar when no separate radar color is saved", () => {
    const block = { ...graphic, data: { ...graphic.data, radarColor: undefined } };
    act(() => root.render(createElement(PreviewBlock, { block, device: "desktop", orientation: "portrait" })));
    expect(container.querySelector<HTMLButtonElement>(".labeled-graphic-radar")?.style.getPropertyValue("--radar-color")).toBe("#123456");
  });

  it("keeps legacy point colors and default label text when newer settings are absent", () => {
    const colors = ["#dc2626", "#2563eb"];
    const expected = ["rgb(220, 38, 38)", "rgb(37, 99, 235)"];
    const block = { ...graphic, data: { ...graphic.data, markerColor: undefined, textColor: undefined, radarColor: undefined, markers: graphic.data.markers.map((marker, index) => ({ ...marker, color: colors[index] })) } };
    act(() => root.render(createElement(PreviewBlock, { block, device: "desktop", orientation: "portrait" })));
    for (const [index, marker] of [...container.querySelectorAll<HTMLButtonElement>(".labeled-graphic-radar")].entries()) {
      expect(marker.style.backgroundColor).toBe(expected[index]);
      expect(marker.style.color).toBe("rgb(255, 255, 255)");
      expect(marker.style.getPropertyValue("--radar-color")).toBe(colors[index]);
    }
  });

  it("uses each point's color ahead of the shared default while uncolored points inherit it", () => {
    const block = { ...graphic, data: { ...graphic.data, markers: graphic.data.markers.map((marker, index) => index === 0 ? { ...marker, color: "#dc2626" } : marker) } };
    act(() => root.render(createElement(PreviewBlock, { block, device: "desktop", orientation: "portrait" })));
    const markers = [...container.querySelectorAll<HTMLButtonElement>(".labeled-graphic-radar")];
    expect(markers.map((marker) => marker.style.backgroundColor)).toEqual(["rgb(220, 38, 38)", "rgb(18, 52, 86)"]);
    expect(markers.every((marker) => marker.style.getPropertyValue("--radar-color") === "#f97316")).toBe(true);
  });

  it("keeps the course primary color fallback for graphics without saved colors", () => {
    const block = { ...graphic, data: { ...graphic.data, markerColor: undefined, textColor: undefined, radarColor: undefined, markers: graphic.data.markers.map((marker) => ({ ...marker, color: undefined })) } };
    act(() => root.render(createElement(PreviewBlock, { block, device: "desktop", orientation: "portrait" })));
    expect(container.querySelector<HTMLButtonElement>(".labeled-graphic-radar")?.style.backgroundColor).toBe("var(--course-primary, #2f5f9f)");
  });

  it("updates all saved colors when the preview receives an edited block", () => {
    act(() => root.render(createElement(PreviewBlock, { block: graphic, device: "desktop", orientation: "portrait" })));
    const block = { ...graphic, data: { ...graphic.data, markerColor: "#22c55e", textColor: "#111111", radarColor: "#a855f7" } };
    act(() => root.render(createElement(PreviewBlock, { block, device: "desktop", orientation: "portrait" })));
    const marker = container.querySelector<HTMLButtonElement>(".labeled-graphic-radar")!;
    expect(marker.style.backgroundColor).toBe("rgb(34, 197, 94)");
    expect(marker.style.color).toBe("rgb(17, 17, 17)");
    expect(marker.style.getPropertyValue("--radar-color")).toBe("#a855f7");
  });

  it.each([false, true])("retains graphic colors through the complete course renderer (standalone=%s)", (standalone) => {
    const initialData: PreviewData = {
      courseId: "course", title: "Graphic colors", description: "", authorVisible: false,
      theme: { preset: "forest", primaryColor: "#24734f", accentColor: "#f2a65a", fontFamily: "sans" },
      sections: [{ id: "learn", title: "Learn", order: 0 }],
      lessons: [{ id: "lesson", sectionId: "learn", title: "Diagram", lessonType: "content", order: 0, quizQuestions: [], blocks: [graphic] }],
    };
    container.innerHTML = renderToStaticMarkup(createElement(CoursePreview, { initialData, authorName: "", initialLessonId: "lesson", standalone }));
    expectSavedColors(container);
  });
});
