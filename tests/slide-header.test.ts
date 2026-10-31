import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { defaultSlideCover, defaultSlideMaster, resolveSlideHeader, slideHeaderSchema, slideMasterSchema } from "@/lib/editor/slide-design";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { courseAssetIds, remapCourseAssetUrls } from "@/lib/media/asset-references";
import { parseScorm12Snapshot } from "@/lib/scorm12/snapshot";
import { Course } from "@/models/Course";
import { CoursePreview } from "@/app/courses/[courseId]/preview/course-preview";
import { SlideThumbnail } from "@/app/courses/[courseId]/_components/slide-presentation/slide-thumbnail";
import { SlideCoverSurface } from "@/app/courses/[courseId]/_components/slide-presentation/slide-cover-surface";

const assetId = "123456789012345678901234";
const imageSrc = `/api/assets/${assetId}/file`;
const course = { title: "Presentation", description: "", revision: 0, courseLayout: "slides", sections: [{ id: "section", title: "Slides", order: 0 }], lessons: [{ id: "first", sectionId: "section", title: "Introduction", order: 0, blocks: [] }] };

describe("presentation headers", () => {
  it("keeps old presentations transparent and inherits their title color", () => {
    expect(defaultSlideMaster.header).toBeUndefined();
    expect(resolveSlideHeader(defaultSlideMaster)).toMatchObject({ background: "transparent", imageSrc: "" });
    expect(resolveSlideHeader(defaultSlideMaster).textColor).toBeUndefined();
  });

  it("validates header styles and retains them in the existing Course document", () => {
    for (const header of [{ background: "color", backgroundColor: "#123456", textColor: "#ffffff" }, { background: "image", imageSrc, imagePosition: "bottom", overlayOpacity: 40 }]) {
      const master = slideMasterSchema.parse({ header });
      const document = new Course({ ownerId: assetId, title: "Slides", slideMaster: master });
      expect(document.validateSync()).toBeUndefined();
      expect(slideMasterSchema.parse(document.toObject().slideMaster).header).toEqual(master.header);
    }
    for (const header of [{ background: "unknown" }, { backgroundColor: "red" }, { textColor: "red" }, { imageSrc: "https://example.com/header.png" }, { imagePosition: "left" }, { overlayOpacity: 91 }, { overlayOpacity: 20.5 }]) expect(slideHeaderSchema.safeParse(header).success).toBe(false);
  });

  it.each(["content", "quiz"] as const)("renders the header on %s slides in preview and standalone", (lessonType) => {
    const snapshot = editorSnapshotSchema.parse({ ...course, slideMaster: { header: { background: "color", backgroundColor: "#123456", textColor: "#ffffff" } }, lessons: [{ ...course.lessons[0], lessonType }] });
    for (const standalone of [false, true]) {
      const markup = renderToStaticMarkup(createElement(CoursePreview, { initialData: { ...snapshot, courseId: "slides" }, authorName: "", initialLessonId: "first", standalone }));
      expect(markup).toContain('data-slide-header-background="color"');
      expect(markup).toContain("background-color:#123456");
      expect(markup).toContain('style="color:#ffffff"');
    }
  });

  it("shares the header with thumbnails while covers retain their hero background", () => {
    const master = slideMasterSchema.parse({ header: { background: "image", imageSrc } });
    const thumbnail = renderToStaticMarkup(createElement(SlideThumbnail, { slide: { id: "first", title: "Introduction", blocks: [] }, index: 0, master }));
    expect(thumbnail).toContain('data-slide-header-background="image"'); expect(thumbnail).toContain(imageSrc);
    const cover = renderToStaticMarkup(createElement(SlideCoverSurface, { title: "Cover", cover: defaultSlideCover, master }));
    expect(cover).not.toContain("data-slide-header-background");
  });

  it.each(["./media/header.png", "data:image/png;base64,YQ=="])("packages header images for offline exports (%s)", (source) => {
    const snapshot = editorSnapshotSchema.parse({ ...course, slideMaster: { header: { background: "image", imageSrc, imagePosition: "bottom", overlayOpacity: 45 } } });
    expect([...courseAssetIds(snapshot)]).toEqual([assetId]);
    const packaged = parseScorm12Snapshot(remapCourseAssetUrls(snapshot, new Map([[assetId, source]])));
    expect(packaged.slideMaster?.header).toMatchObject({ imageSrc: source, imagePosition: "bottom", overlayOpacity: 45 });
    const markup = renderToStaticMarkup(createElement(CoursePreview, { initialData: { ...packaged, courseId: "slides" }, authorName: "", initialLessonId: "first", standalone: true }));
    expect(markup).toContain(`src="${source}"`); expect(markup).toContain("object-position:bottom"); expect(markup).toContain("opacity:0.45"); expect(markup).not.toContain("/api/assets/");
  });
});
