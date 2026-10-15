/** @vitest-environment jsdom */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { blockSchema } from "../lib/schemas/block";
import { PreviewBlock } from "../app/courses/[courseId]/preview/_components/(course_preview_components)/(lesson_reader_preview_components)/(lesson_blocks_preview_components)/preview-block";
import { CoursePreview, type PreviewData } from "../app/courses/[courseId]/preview/course-preview";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const graphic = blockSchema.parse({
  id: "graphic", version: 1, type: "labeledGraphic",
  data: {
    src: "/diagram.png", alt: "System diagram", markerColor: "#123456", textColor: "#fef3c7", radarColor: "#f97316",
    markers: [
      { id: "input", label: "Input", description: "Information enters here.", x: 20, y: 30, color: "#dc2626" },
      { id: "output", label: "Output", description: "The result appears here.", x: 80, y: 70, color: "#2563eb" },
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
    const block = { ...graphic, data: { ...graphic.data, markerColor: undefined, textColor: undefined, radarColor: undefined } };
    act(() => root.render(createElement(PreviewBlock, { block, device: "desktop", orientation: "portrait" })));
    for (const marker of container.querySelectorAll<HTMLButtonElement>(".labeled-graphic-radar")) {
      expect(marker.style.backgroundColor).toBe("rgb(220, 38, 38)");
      expect(marker.style.color).toBe("rgb(255, 255, 255)");
      expect(marker.style.getPropertyValue("--radar-color")).toBe("#dc2626");
    }
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
