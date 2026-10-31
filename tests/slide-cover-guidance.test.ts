import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { defaultSlideCover, slideCoverSchema, slideCoverPositions, slideMasterSchema } from "@/lib/editor/slide-design";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { fitCoverContent } from "@/lib/editor/slide-cover-layout";
import { courseAssetIds, remapCourseAssetUrls } from "@/lib/media/asset-references";
import { parseScorm12Snapshot } from "@/lib/scorm12/snapshot";
import { SlideCoverSurface } from "@/app/courses/[courseId]/_components/slide-presentation/slide-cover-surface";
import { Course } from "@/models/Course";

const audioId = "123456789012345678901234";
const audioSrc = `/api/assets/${audioId}/file`;
const snapshot = (cover: unknown) => editorSnapshotSchema.parse({ title: "Presentation", description: "", revision: 0, courseLayout: "slides", sections: [{ id: "section", title: "Slides", order: 0 }], lessons: [{ id: "cover", sectionId: "section", title: "Cover", order: 0, blocks: [], slideCover: cover }] });

describe("cover layout and instruction contracts", () => {
  it("preserves old covers and rejects invalid positions, offsets, and external audio", () => {
    expect(defaultSlideCover.contentPosition).toBeUndefined(); expect(defaultSlideCover.instructions).toBeUndefined();
    for (const update of [{ contentPosition: "outside" }, { titleLayout: { position: "top-left", offsetX: 3841 } }, { instructions: { audioSrc: "https://example.com/intro.mp3" } }, { instructions: { audioTrigger: "always" } }, { instructions: { noticeTitle: "" } }]) expect(slideCoverSchema.safeParse({ ...defaultSlideCover, ...update }).success).toBe(false);
  });

  it.each(slideCoverPositions)("renders independent cover elements at %s", (position) => {
    const cover = slideCoverSchema.parse({ ...defaultSlideCover, subtitle: "Instructions", contentPosition: position, titleLayout: { position }, subtitleLayout: { position, offsetY: 20 }, buttonLayout: { position, offsetX: 12.34 } });
    const markup = renderToStaticMarkup(createElement(SlideCoverSurface, { cover, title: "Course title" }));
    expect(markup).toContain(`data-cover-content-position="${position}"`);
    for (const element of ["title", "subtitle", "button"]) expect(markup).toContain(`data-cover-position="${element}"`);
    expect(markup).toContain("translate(12.34px");
  });

  it("fits long content above the footer while retaining the chosen corner and offsets", () => {
    const fit = fitCoverContent({ width: 352, height: 344 }, { width: 352, height: 688 }, { position: "bottom-right", offsetX: -8, offsetY: -12 });
    expect(fit.scale).toBe(0.5); expect(fit.left).toBe(168); expect(fit.top).toBe(-12);
    expect(688 * fit.scale).toBeLessThanOrEqual(344);
  });

  it.each(["./media/intro.mp3", "data:audio/mpeg;base64,YQ=="])("packages instruction audio for static learners (%s)", (source) => {
    const value = snapshot({ ...defaultSlideCover, instructions: { audioSrc, audioName: "Introduction.mp3", audioTrigger: "start", noticeEnabled: true, noticeText: "Click Next to continue." }, titleLayout: { position: "top-left", offsetX: 12.34 } });
    expect([...courseAssetIds(value)]).toEqual([audioId]);
    const packaged = parseScorm12Snapshot(remapCourseAssetUrls(value, new Map([[audioId, source]])));
    expect(packaged.lessons[0].slideCover?.instructions).toMatchObject({ audioSrc: source, audioTrigger: "start", noticeEnabled: true });
    expect(packaged.lessons[0].slideCover?.titleLayout?.offsetX).toBe(12.34);
  });

  it("persists optional navigation guide settings on the existing Course document", () => {
    const master = slideMasterSchema.parse({ navigationGuide: { enabled: true, nextText: "Click Next after the activity." } });
    const document = new Course({ ownerId: audioId, title: "Presentation", slideMaster: master });
    expect(document.validateSync()).toBeUndefined(); expect(slideMasterSchema.parse(document.toObject().slideMaster).navigationGuide).toEqual(master.navigationGuide);
    expect(slideMasterSchema.parse({}).navigationGuide).toBeUndefined();
    expect(slideMasterSchema.safeParse({ navigationGuide: { nextText: "" } }).success).toBe(false);
  });
});
