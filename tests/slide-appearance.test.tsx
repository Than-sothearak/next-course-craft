import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SlideSurface } from "@/app/courses/[courseId]/_components/slide-presentation/slide-surface";
import { SlideCoverSurface } from "@/app/courses/[courseId]/_components/slide-presentation/slide-cover-surface";
import { defaultSlideCover, slideAppearanceSchema, slideMasterSchema } from "@/lib/editor/slide-design";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { duplicatePresentationSlide } from "@/lib/editor/course-content";
import { courseAssetIds, remapCourseAssetUrls } from "@/lib/media/asset-references";
import { parseScorm12Snapshot } from "@/lib/scorm12/snapshot";
import { Lesson } from "@/models/Lesson";

const assetId = "123456789012345678901234", imageSrc = `/api/assets/${assetId}/file`;
const appearance = slideAppearanceSchema.parse({ hideHeader: true, hideFooter: true, background: { type: "image", imageSrc, overlayOpacity: 0, imagePosition: "top" } });
const master = slideMasterSchema.parse({ footerText: "Master branding", background: { type: "abstract", design: "waves" } });
const snapshot = () => editorSnapshotSchema.parse({ title: "Slides", description: "", revision: 0, courseLayout: "slides", slideMaster: master, sections: [{ id: "section", title: "Slides", order: 0 }], lessons: [{ id: "slide", sectionId: "section", title: "Image slide", order: 0, blocks: [], slideAppearance: appearance }, { id: "other", sectionId: "section", title: "Normal slide", order: 1, blocks: [] }] });

describe("per-slide backgrounds and blank layouts", () => {
  it("keeps legacy defaults and validates images and visibility independently", () => {
    expect(slideAppearanceSchema.parse({})).toEqual({ hideHeader: false, hideFooter: false });
    for (const invalid of [{ hideHeader: "true" }, { hideFooter: 1 }, { background: { type: "image", imageSrc: "https://outside.test/image.png" } }, { background: { type: "image", imageSrc, overlayOpacity: 101 } }]) expect(slideAppearanceSchema.safeParse(invalid).success).toBe(false);
  });
  it("renders a full background without header/footer decorations, preserving objects and navigation", () => {
    const html = renderToStaticMarkup(<SlideSurface master={master} appearance={appearance} title="Hidden title" number={1} total={2} controls={<button>Next</button>}><div>Editable object</div></SlideSurface>);
    expect(html).toContain(`src="${imageSrc}"`); expect(html).toContain("object-cover"); expect(html).toContain("object-position:top"); expect(html).toContain("opacity:0");
    expect(html).not.toContain("data-slide-header"); expect(html).not.toContain("data-slide-footer="); expect(html).not.toContain("Master branding"); expect(html).not.toContain("data-abstract-design");
    expect(html).toContain("Editable object"); expect(html).toContain("data-slide-floating-navigation"); expect(html).toContain("Next");
    const other = renderToStaticMarkup(<SlideSurface master={master} title="Normal title" number={2} total={2} />);
    expect(other).toContain("data-slide-header"); expect(other).toContain("data-slide-footer"); expect(other).toContain('data-abstract-design="waves"');
  });
  it.each([[true, false], [false, true], [true, true]])("reclaims quiz canvas space when header=%s/footer=%s are hidden", (hideHeader, hideFooter) => {
    const html = renderToStaticMarkup(<SlideSurface appearance={{ hideHeader, hideFooter }} title="Quiz" number={1} total={1} contentRegion><div>Question</div></SlideSurface>);
    expect(html).toContain(`top:${hideHeader ? "0" : "108px"};bottom:${hideFooter ? "0" : "64px"}`);
    expect(html.includes("data-slide-header")).toBe(!hideHeader); expect(html.includes("data-slide-footer=")).toBe(!hideFooter);
  });
  it("uses matching blank backgrounds on covers and avoids thumbnail navigation", () => {
    const html = renderToStaticMarkup(<SlideCoverSurface appearance={appearance} master={master} cover={defaultSlideCover} title="Cover title" decorative controls={<button>Next</button>} />);
    expect(html).toContain(`src="${imageSrc}"`); expect(html).not.toContain("Cover title"); expect(html).not.toContain("data-slide-thumbnail-footer"); expect(html).not.toContain("data-slide-floating-navigation");
  });
  it("preserves independent settings in the Lesson model, slide duplication, and SCORM snapshots", () => {
    const course = snapshot(), document = new Lesson({ courseId: assetId, editorId: "slide", sectionId: "section", order: 0, slideAppearance: appearance });
    expect(document.validateSync()).toBeUndefined(); expect(document.toObject().slideAppearance).toEqual(appearance);
    const copy = duplicatePresentationSlide(course, "slide", () => "copied").course.lessons.find((slide) => slide.id === "copied")!;
    expect(copy.slideAppearance).toEqual(appearance); expect(parseScorm12Snapshot(course).lessons[0].slideAppearance).toEqual(appearance);
    expect(course.lessons[1].slideAppearance).toBeUndefined();
  });
  it.each(["./media/slide.png", "data:image/png;base64,YQ=="])("packages slide-specific background assets for offline learners (%s)", (source) => {
    const course = snapshot(); expect([...courseAssetIds(course)]).toEqual([assetId]);
    const packaged = editorSnapshotSchema.parse(remapCourseAssetUrls(course, new Map([[assetId, source]])));
    expect([...courseAssetIds(packaged)]).toEqual([]);
    const html = renderToStaticMarkup(<SlideSurface appearance={packaged.lessons[0].slideAppearance} title="Image slide" number={1} total={2} />);
    expect(html).toContain(`src="${source}"`); expect(html).not.toContain("/api/assets/");
  });
});
