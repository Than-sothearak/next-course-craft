import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { resolveSlideFooter, slideFooterSchema, slideMasterSchema } from "@/lib/editor/slide-design";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { courseAssetIds, remapCourseAssetUrls } from "@/lib/media/asset-references";
import { Course } from "@/models/Course";
import { CoursePreview } from "@/app/courses/[courseId]/preview/course-preview";

const assetId = "123456789012345678901234";
const logos = [{ id: "brand", src: `/api/assets/${assetId}/file`, alt: "Brand logo" }];
const footer = slideFooterSchema.parse({ content: "both", logos, paddingX: 12, paddingY: 5, logoGapX: 16, logoGapY: 6, logoJustify: "right", logoAlign: "bottom", backgroundColor: "#172554", textColor: "#ffffff", borderTop: true, borderColor: "#f59e0b", borderWidth: 3 });
const data = {
  courseId: "footer-slides", title: "Presentation", description: "", revision: 0, courseLayout: "slides",
  sections: [{ id: "section", title: "Slides", order: 0 }],
  lessons: [{ id: "first", sectionId: "section", title: "Introduction", order: 0, blocks: [] }, { id: "second", sectionId: "section", title: "Practice", order: 1, blocks: [] }],
};

describe("presentation footers", () => {
  it("retains legacy footer text and follows the old master's colors", () => {
    const master = slideMasterSchema.parse({ footerText: "Training", template: "midnight", backgroundColor: "#0f172a", textColor: "#f8fafc", accentColor: "#a5b4fc" });
    expect(master.footer).toBeUndefined();
    expect(resolveSlideFooter(master)).toMatchObject({ content: "text", logos: [], paddingX: 20, paddingY: 8, backgroundColor: "#0f172a", textColor: "#f8fafc", borderColor: "#a5b4fc" });
    expect(slideFooterSchema.parse({ logos })).toMatchObject({ paddingX: 20, paddingY: 8, logoGapX: 8, logoGapY: 4, logoJustify: "center", logoAlign: "middle" });
    const older = slideFooterSchema.parse({ logos, logoPaddingX: 32, logoPaddingY: 16 });
    expect(older).toMatchObject({ paddingX: 20, paddingY: 8 });
    expect(older).not.toHaveProperty("logoPaddingX"); expect(older).not.toHaveProperty("logoPaddingY");
  });

  it("validates logo counts, unique IDs, owned image URL forms, and footer styles", () => {
    const many = Array.from({ length: 12 }, (_, index) => ({ ...logos[0], id: `logo-${index}` }));
    expect(slideFooterSchema.parse({ logos: many }).logos).toHaveLength(12);
    for (const invalid of [
      { logos: [...many, { ...logos[0], id: "extra" }] }, { logos: [logos[0], logos[0]] },
      { logos: [{ ...logos[0], src: "https://example.com/logo.png" }] }, { logos: [{ ...logos[0], src: "" }] },
      { backgroundColor: "red" }, { textColor: "#fff" }, { borderColor: "transparent" },
      { borderWidth: 0 }, { borderWidth: 7 }, { borderWidth: 1.5 }, { content: "video" },
      { paddingX: -1 }, { paddingX: 65 }, { paddingX: 1.5 },
      { paddingY: -1 }, { paddingY: 33 }, { paddingY: "8" },
      { logoGapX: -1 }, { logoGapX: 33 }, { logoGapX: 1.5 }, { logoGapX: "8" },
      { logoGapY: -1 }, { logoGapY: 13 }, { logoGapY: 0.5 },
      { logoJustify: "stretch" }, { logoAlign: "left" },
    ]) expect(slideFooterSchema.safeParse(invalid).success).toBe(false);
  });

  it("persists the master footer in the Course document", () => {
    const master = slideMasterSchema.parse({ footerText: "Training", footer });
    const document = new Course({ ownerId: assetId, title: "Presentation", slideMaster: master });
    expect(document.validateSync()).toBeUndefined();
    expect(slideMasterSchema.parse(document.toObject().slideMaster)).toEqual(master);
  });

  it("bounds footer padding, logo gaps, and alignment in Course persistence", () => {
    for (const padding of [{ paddingX: -1 }, { paddingX: 65 }, { paddingY: -1 }, { paddingY: 33 }, { logoGapX: -1 }, { logoGapX: 33 }, { logoGapY: -1 }, { logoGapY: 13 }, { logoJustify: "stretch" }, { logoAlign: "left" }]) {
      const document = new Course({ ownerId: assetId, title: "Presentation", slideMaster: { footer: { ...footer, ...padding } } });
      expect(document.validateSync()).toBeDefined();
    }
  });

  it.each([false, true])("places navigation inside the styled footer in preview/export (standalone=%s)", (standalone) => {
    const snapshot = editorSnapshotSchema.parse({ ...data, slideMaster: { footer, footerText: "Partner training" } });
    const markup = renderToStaticMarkup(createElement(CoursePreview, { initialData: { ...snapshot, courseId: data.courseId }, authorName: "Author", initialLessonId: "first", standalone }));
    const footerMarkup = markup.match(/<footer\b[^>]*data-slide-footer[\s\S]*?<\/footer>/)?.[0];
    expect(footerMarkup).toContain('aria-label="Slide navigation"');
    expect(footerMarkup).toContain("Previous"); expect(footerMarkup).toContain("Next");
    expect(footerMarkup).toContain("Partner training"); expect(footerMarkup).toContain('alt="Brand logo"');
    expect(footerMarkup).toContain("inset-x-0"); expect(footerMarkup).toContain("w-full");
    expect(footerMarkup).toContain("background-color:#172554"); expect(footerMarkup).toContain("border-top-width:3px");
    expect(footerMarkup).toContain("border-top-color:#f59e0b");
    expect(footerMarkup).toContain("padding-inline:12px"); expect(footerMarkup).toContain("padding-block:5px");
  });

  it("shows the same footer and navigation on image cover slides", () => {
    const snapshot = editorSnapshotSchema.parse({ ...data, slideMaster: { footer, footerText: "Partner training" }, lessons: [{ ...data.lessons[0], slideCover: { template: "imageCover" } }, data.lessons[1]] });
    const markup = renderToStaticMarkup(createElement(CoursePreview, { initialData: { ...snapshot, courseId: data.courseId }, authorName: "Author", initialLessonId: "first", standalone: true }));
    const footerMarkup = markup.match(/<footer\b[^>]*data-slide-footer[\s\S]*?<\/footer>/)?.[0];
    expect(footerMarkup).toContain('aria-label="Slide navigation"');
    expect(footerMarkup).toContain('alt="Brand logo"'); expect(footerMarkup).toContain("Partner training");
    expect(footerMarkup).toContain("padding-inline:12px"); expect(footerMarkup).toContain("padding-block:5px");
  });

  it.each(["./media/brand.png", "data:image/png;base64,YQ=="])("packages footer logos for offline use (%s)", (src) => {
    const snapshot = editorSnapshotSchema.parse({ ...data, slideMaster: { footer } });
    expect([...courseAssetIds(snapshot)]).toEqual([assetId]);
    const packaged = editorSnapshotSchema.parse(remapCourseAssetUrls(snapshot, new Map([[assetId, src]])));
    expect(packaged.slideMaster?.footer).toMatchObject({ paddingX: 12, paddingY: 5, logoGapX: 16, logoGapY: 6, logoJustify: "right", logoAlign: "bottom" });
    expect([...courseAssetIds(packaged)]).toEqual([]);
    const markup = renderToStaticMarkup(createElement(CoursePreview, { initialData: { ...packaged, courseId: data.courseId }, authorName: "Author", initialLessonId: "first", standalone: true }));
    expect(markup).toContain(`src="${src}"`); expect(markup).not.toContain("/api/assets/");
  });

  it("honors logos-only content, hidden numbers, and no top border", () => {
    const snapshot = editorSnapshotSchema.parse({ ...data, slideMaster: { footerText: "Hidden branding text", showSlideNumber: false, footer: { ...footer, content: "logos", borderTop: false } } });
    const markup = renderToStaticMarkup(createElement(CoursePreview, { initialData: { ...snapshot, courseId: data.courseId }, authorName: "Author", initialLessonId: "first", standalone: true }));
    expect(markup).not.toContain("Hidden branding text"); expect(markup).not.toContain('aria-label="Slide number"');
    expect(markup).toContain('alt="Brand logo"'); expect(markup).toContain("border-top-width:0");
  });
});
