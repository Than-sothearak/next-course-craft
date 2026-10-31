import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { slideAbstractDesigns, slideMasterSchema } from "@/lib/editor/slide-design";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { courseAssetIds, remapCourseAssetUrls } from "@/lib/media/asset-references";
import { Course } from "@/models/Course";
import { CoursePreview } from "@/app/courses/[courseId]/preview/course-preview";

const assetId = "123456789012345678901234";
const imageSrc = `/api/assets/${assetId}/file`;
const course = {
  courseId: "slides", title: "Presentation", description: "", revision: 0, courseLayout: "slides",
  sections: [{ id: "section", title: "Slides", order: 0 }],
  lessons: [{ id: "first", sectionId: "section", title: "Introduction", order: 0, blocks: [] }],
};

describe("master slide backgrounds", () => {
  it("preserves older themes and validates background choices", () => {
    expect(slideMasterSchema.parse({ template: "gradient" }).background).toBeUndefined();
    expect(slideMasterSchema.parse({ background: { type: "image", imageSrc } }).background).toEqual({ type: "image", imageSrc, imagePosition: "center", overlayOpacity: 30 });
    for (const background of [
      { type: "abstract", design: "unknown" }, { type: "image", imageSrc: "https://example.com/background.jpg" },
      { type: "image", imageSrc, imagePosition: "left" }, { type: "image", imageSrc, overlayOpacity: 91 },
      { type: "image", imageSrc, overlayOpacity: -1 },
    ]) expect(slideMasterSchema.safeParse({ background }).success).toBe(false);
  });

  it.each(slideAbstractDesigns)("renders the $name design in preview and standalone", ({ id }) => {
    const snapshot = editorSnapshotSchema.parse({ ...course, slideMaster: { background: { type: "abstract", design: id } } });
    for (const standalone of [false, true]) {
      const markup = renderToStaticMarkup(createElement(CoursePreview, { initialData: { ...snapshot, courseId: "slides" }, authorName: "Author", initialLessonId: "first", standalone }));
      expect(markup).toContain(`data-abstract-design="${id}"`);
      expect(markup).toContain('data-slide-master-background="abstract"');
      expect(markup).toContain('aria-label="Slide navigation"');
    }
  });

  it.each(["./media/background.png", "data:image/png;base64,YQ=="])("packages a master image for offline output (%s)", (offlineSource) => {
    const snapshot = editorSnapshotSchema.parse({ ...course, slideMaster: { background: { type: "image", imageSrc, imagePosition: "top", overlayOpacity: 45 } } });
    expect([...courseAssetIds(snapshot)]).toEqual([assetId]);
    const packaged = editorSnapshotSchema.parse(remapCourseAssetUrls(snapshot, new Map([[assetId, offlineSource]])));
    expect([...courseAssetIds(packaged)]).toEqual([]);
    const markup = renderToStaticMarkup(createElement(CoursePreview, { initialData: { ...packaged, courseId: "slides" }, authorName: "Author", initialLessonId: "first", standalone: true }));
    expect(markup).toContain(`src="${offlineSource}"`);
    expect(markup).toContain("object-position:top");
    expect(markup).toContain("opacity:0.45");
    expect(markup).not.toContain("/api/assets/");
  });

  it.each([
    { type: "solid" }, { type: "abstract", design: "prism" },
    { type: "image", imageSrc, imagePosition: "bottom", overlayOpacity: 60 },
  ])("retains the validated background in the Course document ($type)", (background) => {
    const master = slideMasterSchema.parse({ background });
    const document = new Course({ ownerId: assetId, title: "Presentation", slideMaster: master });
    expect(document.validateSync()).toBeUndefined();
    expect(slideMasterSchema.parse(document.toObject().slideMaster)).toEqual(master);
  });
});
