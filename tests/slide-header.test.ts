import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { defaultSlideCover, defaultSlideMaster, resolveSlideHeader, resolveSlideHeaderTypography, slideHeaderSchema, slideHeaderStyleSchema, slideMasterSchema } from "@/lib/editor/slide-design";
import { Lesson } from "@/models/Lesson";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { courseAssetIds, remapCourseAssetUrls } from "@/lib/media/asset-references";
import { parseScorm12Snapshot } from "@/lib/scorm12/snapshot";
import { Course } from "@/models/Course";
import { CoursePreview } from "@/app/courses/[courseId]/preview/course-preview";
import { SlideThumbnail } from "@/app/courses/[courseId]/_components/slide-presentation/slide-thumbnail";
import { SlideCoverSurface } from "@/app/courses/[courseId]/_components/slide-presentation/slide-cover-surface";
import { SlideSurface } from "@/app/courses/[courseId]/_components/slide-presentation/slide-surface";

const assetId = "123456789012345678901234";
const imageSrc = `/api/assets/${assetId}/file`;
const course = { title: "Presentation", description: "", revision: 0, courseLayout: "slides", sections: [{ id: "section", title: "Slides", order: 0 }], lessons: [{ id: "first", sectionId: "section", title: "Introduction", order: 0, blocks: [] }] };

describe("presentation headers", () => {
  it("inherits master colors when only header layout or typography changes", () => {
    const master = slideMasterSchema.parse({ backgroundColor: "#0f172a", textColor: "#f8fafc", header: { background: "color", fontWeight: "normal" } });
    expect(resolveSlideHeader(master).backgroundColor).toBe("#0f172a");
    const changed = { ...master, backgroundColor: "#fff7ed", textColor: "#431407" };
    expect(resolveSlideHeader(changed).backgroundColor).toBe("#fff7ed");
    const markup = renderToStaticMarkup(createElement(SlideSurface, { master: changed, title: "Theme title", number: 1, total: 1 }));
    expect(markup).toContain("background-color:#fff7ed");
    expect(markup).toMatch(/data-slide-header[^>]*style="[^"]*color:#431407/);
    const legacy = slideMasterSchema.parse({ ...master, header: { ...master.header, background: "transparent", backgroundColor: "#ffffff" } });
    expect(resolveSlideHeader(legacy).backgroundColor).toBe("#0f172a");
    expect(resolveSlideHeader({ ...legacy, header: { ...legacy.header!, backgroundCustomized: true } }).backgroundColor).toBe("#ffffff");
    expect(resolveSlideHeader({ ...legacy, header: { ...legacy.header!, background: "color" } }).backgroundColor).toBe("#ffffff");
  });

  it("keeps old presentations transparent and inherits their title color", () => {
    expect(defaultSlideMaster.header).toBeUndefined();
    expect(resolveSlideHeader(defaultSlideMaster)).toMatchObject({ background: "transparent", imageSrc: "" });
    expect(resolveSlideHeader(defaultSlideMaster).textColor).toBeUndefined();
    expect(resolveSlideHeader(defaultSlideMaster)).toMatchObject({ borderTop: true, borderBottom: false, borderWidth: 8, borderColor: defaultSlideMaster.accentColor });
  });

  it("validates and persists independently enabled header borders", () => {
    const master = slideMasterSchema.parse({ header: { borderTop: false, borderBottom: true, borderWidth: 6, borderColor: "#ef4444" } });
    const document = new Course({ ownerId: assetId, title: "Slides", slideMaster: master });
    expect(document.validateSync()).toBeUndefined();
    expect(slideMasterSchema.parse(document.toObject().slideMaster).header).toEqual(master.header);
    for (const invalid of [{ borderWidth: 0 }, { borderWidth: 17 }, { borderWidth: 1.5 }, { borderColor: "red" }, { borderBottom: {} }]) {
      expect(slideHeaderSchema.safeParse(invalid).success).toBe(false);
      expect(new Course({ ownerId: assetId, title: "Slides", slideMaster: { header: invalid } }).validateSync()).toBeDefined();
    }
  });

  it("renders configured borders in thumbnails, preview, and standalone slides", () => {
    const snapshot = editorSnapshotSchema.parse({ ...course, slideMaster: { header: { borderTop: false, borderBottom: true, borderWidth: 6, borderColor: "linear-gradient(90deg, #ef4444 0%, #3b82f6 100%)" } } });
    const views = [renderToStaticMarkup(createElement(SlideThumbnail, { slide: snapshot.lessons[0], index: 0, master: snapshot.slideMaster }))];
    for (const standalone of [false, true]) views.push(renderToStaticMarkup(createElement(CoursePreview, { initialData: { ...snapshot, courseId: "slides" }, authorName: "", initialLessonId: "first", standalone })));
    for (const markup of views) {
      expect(markup).not.toContain('data-slide-header-border="top"');
      expect(markup.match(/data-slide-header-border="bottom"[^>]*>/)?.[0]).toContain("height:6px");
      expect(markup.match(/data-slide-header-border="bottom"[^>]*>/)?.[0]).toContain("linear-gradient");
    }
  });

  it("renders runtime export image URLs without allowing them in saved header settings", () => {
    const master = slideMasterSchema.parse({ header: { background: "image", imageSrc } });
    const runtime = { ...master, header: { ...master.header!, imageSrc: "blob:header-export" } };
    expect(slideHeaderSchema.safeParse(runtime.header).success).toBe(false);
    expect(renderToStaticMarkup(createElement(SlideSurface, { master: runtime, title: "Header", number: 1, total: 1 }))).toContain('src="blob:header-export"');
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
      expect(markup).toMatch(/data-slide-header[^>]*style="[^"]*color:#ffffff/);
      expect(markup).toMatch(/data-slide-header[^>]*style="[^"]*font-size:32px/);
    }
  });

  it("keeps long slide titles on one line like the editor", () => {
    const markup = renderToStaticMarkup(createElement(SlideSurface, { title: "A presentation title that should remain on one line", number: 1, total: 1, menuControl: createElement("button", { type: "button" }, "Menu") }, null));
    expect(markup).toContain('data-slide-header');
    expect(markup).toContain('data-slide-title-text');
    expect(markup).toContain('class="absolute left-12 right-12 top-9');
    expect(markup).not.toContain('min-h-14 truncate');
  });

  it("validates per-slide text formatting and retains it in lesson documents and export snapshots", () => {
    const style = slideHeaderStyleSchema.parse({ fontSize: 22, fontFamily: "serif", color: "#123456", textAlign: "right", fontWeight: "normal", fontStyle: "italic", textDecoration: "underline" });
    const snapshot = editorSnapshotSchema.parse({ ...course, lessons: [{ ...course.lessons[0], slideHeaderStyle: style }] });
    const document = new Lesson({ courseId: assetId, sectionId: "section", order: 0, title: "Introduction", slideHeaderStyle: style });
    expect(document.validateSync()).toBeUndefined();
    expect(document.toObject().slideHeaderStyle).toEqual(style);
    expect(parseScorm12Snapshot(JSON.parse(JSON.stringify(snapshot))).lessons[0].slideHeaderStyle).toEqual(style);
    for (const invalid of [{ fontSize: 11 }, { fontSize: 73 }, { fontSize: 22.5 }, { fontSize: "22" }, { color: "red" }, { textAlign: "justify" }, { fontFamily: "unknown" }]) {
      expect(editorSnapshotSchema.safeParse({ ...snapshot, lessons: [{ ...snapshot.lessons[0], slideHeaderStyle: { ...style, ...invalid } }] }).success).toBe(false);
    }
    expect(resolveSlideHeaderTypography(undefined)).toMatchObject({ fontSize: 32, fontWeight: "bold", textAlign: "left" });
  });

  it.each(["content", "quiz"] as const)("shares per-slide %s title styles across thumbnails, preview, and offline learners", (lessonType) => {
    const style = slideHeaderStyleSchema.parse({ fontSize: 22, fontFamily: "serif", color: "#123456", textAlign: "right", textDecoration: "underline" });
    const snapshot = editorSnapshotSchema.parse({ ...course, slideMaster: { header: { fontSize: 44 } }, lessons: [{ ...course.lessons[0], lessonType, slideHeaderStyle: style }] });
    const markup = [renderToStaticMarkup(createElement(SlideThumbnail, { slide: snapshot.lessons[0], index: 0, master: snapshot.slideMaster }))];
    for (const standalone of [false, true]) markup.push(renderToStaticMarkup(createElement(CoursePreview, { initialData: { ...snapshot, courseId: "slides" }, authorName: "", initialLessonId: "first", standalone })));
    for (const view of markup) {
      const header = view.match(/<header data-slide-header[^>]*>/)?.[0];
      expect(header).toContain("font-size:22px"); expect(header).toContain("text-align:right"); expect(header).toContain("text-decoration:underline"); expect(header).toContain("color:#123456");
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
