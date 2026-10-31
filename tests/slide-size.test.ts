import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { defaultSlideSize, resolveSlideFrame, resolveSlideObjectArea, resolveSlideSize, slideMasterSchema, slideSizePresets, slideSizeSchema } from "@/lib/editor/slide-design";
import { resizeSlideObjectFrame } from "@/lib/editor/slide-objects";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { blockSchema } from "@/lib/schemas/block";
import { Course } from "@/models/Course";
import { CoursePreview } from "@/app/courses/[courseId]/preview/course-preview";

describe("presentation slide dimensions", () => {
  it("keeps older presentations at widescreen size without adding stored metadata", () => {
    const master = slideMasterSchema.parse({});
    expect(master.size).toBeUndefined();
    expect(resolveSlideSize()).toEqual(defaultSlideSize);
    expect(resolveSlideSize(master)).toEqual({ width: 960, height: 540 });
    expect(resolveSlideObjectArea(master)).toEqual({ width: 960, height: 368 });
  });

  it("validates and stores presets, portrait, and custom dimensions", () => {
    for (const size of [...slideSizePresets.map(({ width, height }) => ({ width, height })), { width: 720, height: 960 }, { width: 1280, height: 800 }]) {
      const master = slideMasterSchema.parse({ size });
      const document = new Course({ ownerId: "123456789012345678901234", title: "Slides", slideMaster: master });
      expect(document.validateSync()).toBeUndefined();
      expect(slideMasterSchema.parse(document.toObject().slideMaster).size).toEqual(size);
      expect(resolveSlideObjectArea(master)).toEqual({ width: size.width, height: size.height - 172 });
    }
  });

  it("rejects incomplete, fractional, and out-of-range sizes in both contracts", () => {
    for (const size of [{ width: 479, height: 720 }, { width: 960, height: 3841 }, { width: 960.5, height: 720 }, { width: 960 }]) {
      expect(slideSizeSchema.safeParse(size).success).toBe(false);
      const document = new Course({ ownerId: "123456789012345678901234", title: "Slides", slideMaster: { size } });
      expect(document.validateSync()).toBeDefined();
    }
  });

  it.each([{ width: 960, height: 720 }, { width: 720, height: 960 }, { width: 1280, height: 800 }])("keeps media proportional when the canvas becomes $width x $height", (size) => {
    const block = blockSchema.parse({ id: "image", version: 1, type: "image", data: { src: "/photo.png", alt: "Photo" }, slideMedia: { source: "/photo.png", width: 1600, height: 900 }, slideFrame: { x: 10, y: 5, width: 60, height: 80, z: 0 } });
    const area = resolveSlideObjectArea({ size });
    const frame = resolveSlideFrame(block, 0, 1, area);
    const resized = resizeSlideObjectFrame(block, frame, { height: 30 }, area);
    for (const result of [frame, resized]) {
      expect((result.width * area.width) / (result.height * area.height)).toBeCloseTo(1600 / 900);
      expect(result.x + result.width).toBeLessThanOrEqual(100);
      expect(result.y + result.height).toBeLessThanOrEqual(100);
    }
  });

  it.each([false, true])("retains custom size through snapshot serialization and learner rendering (standalone=%s)", (standalone) => {
    const snapshot = editorSnapshotSchema.parse(JSON.parse(JSON.stringify({ title: "Slides", description: "", revision: 0, courseLayout: "slides", slideMaster: { size: { width: 720, height: 960 } }, sections: [{ id: "section", title: "Slides", order: 0 }], lessons: [{ id: "first", sectionId: "section", title: "First slide", order: 0, blocks: [] }] })));
    const markup = renderToStaticMarkup(createElement(CoursePreview, { initialData: { ...snapshot, courseId: "slides" }, initialLessonId: "first", authorName: "", standalone }));
    expect(markup).toContain("width:720px;height:960px");
    expect(markup).toContain("aspect-ratio:720 / 960");
    expect(markup).not.toContain("aspect-ratio:960 / 540");
  });
});
