import { renderToStaticMarkup } from "react-dom/server";
import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { institutionalGreenMaster as green, masterOverridesFor, masterSafeBounds, masterSlideNumber, renderSlideMaster, resolveSlideMaster, slideMasterSchema } from "../lib/slides/master-schema";
import { defaultSlideTheme, normalizeSlideTheme, slideThemePresets } from "../lib/slides/themes";
import { createLearningBlock, learningPageSchema } from "../lib/slides/blocks";
import { materializeObjectCanvas } from "../lib/slides/object-canvas";
import { LearningPageSurface } from "../components/slides/learning-page-surface";
import { SlideSurface } from "../components/slides/slide-surface";
import { createTemplateSlide } from "../lib/slides/templates";
import { Course } from "../models/Course";
import { Slide } from "../models/Slide";
import { serializeStoredSlide } from "../lib/slides/service";
import { composeLearningPage } from "../lib/slides/pages";

describe("Institutional Green master architecture", () => {
  it("keeps old themes unchanged and round-trips a master through the actual Course and Slide models", () => {
    expect(normalizeSlideTheme(undefined)).toEqual(defaultSlideTheme);
    const theme = slideThemePresets.find((preset) => preset.id === "institutional-green")!.theme;
    const course = new Course({ title: "Institution", ownerId: new Types.ObjectId(), editorType: "slide", slideTheme: theme }).toObject();
    expect(normalizeSlideTheme(course.slideTheme)).toEqual(theme);
    const slide = composeLearningPage({ ...createTemplateSlide("cover", 0), id: "slide" });
    slide.composition!.masterOverrides = { header: { title: { color: "#ff0000" } } };
    slide.composition!.numbering = { hidden: true, value: "A1" };
    expect(serializeStoredSlide(new Slide({ ...slide, slideId: slide.id, courseId: course._id }).toObject()).composition).toEqual(slide.composition);
  });
  it("stores only modified fields and keeps future course edits inheriting", () => {
    const selected = resolveSlideMaster(green, { header: { title: { color: "#ff0000" } } })!;
    const overrides = masterOverridesFor(green, selected);
    expect(overrides).toEqual({ header: { title: { color: "#ff0000" } } });
    const newMaster = { ...green, footer: { ...green.footer, text: "New shared module" } };
    expect(resolveSlideMaster(newMaster, overrides)).toMatchObject({ header: { title: { color: "#ff0000" } }, footer: { text: "New shared module" } });
    expect(masterOverridesFor(green, green)).toEqual({});
    expect(resolveSlideMaster(green)).toEqual(green);
  });
  it("round-trips legacy master metadata without changing content versions", () => {
    const snapshot = { ...createTemplateSlide("image-text", 0), masterOverrides: { header: { color: "#123456" } }, numbering: { value: "B2" } };
    const stored = new Slide({ ...snapshot, courseId: new Types.ObjectId(), slideId: "legacy-template" }).toObject();
    expect(serializeStoredSlide(stored)).toEqual({ ...snapshot, id: "legacy-template" });
    const markup = renderToStaticMarkup(<SlideSurface slide={{ ...snapshot, id: "legacy-template" }} theme={{ ...defaultSlideTheme, master: green }} />);
    expect(markup).toContain('fill="#123456"'); expect(markup).toContain(">B2</div>");
  });
  it("rejects unsafe sources, extra code fields and unusable safe bounds", () => {
    expect(slideMasterSchema.safeParse({ ...green, onclick: "alert(1)" }).success).toBe(false);
    for (const src of ["javascript:alert(1)", "https://example.com/logo.png", "data:image/svg+xml,<svg/>"]) expect(slideMasterSchema.safeParse({ ...green, header: { ...green.header, logo: { ...green.header.logo, src } } }).success).toBe(false);
    expect(() => resolveSlideMaster(green, { content: { x: 1180, width: 1256 } })).toThrow();
    expect(learningPageSchema.safeParse({ layers: [], masterOverrides: { header: { title: { script: "x" } } } }).success).toBe(false);
    expect(masterSafeBounds(green)).toEqual({ x: 44, y: 152, width: 1192, height: 452 });
    expect(masterSafeBounds({ ...green, enabled: false })).toEqual({ x: 0, y: 0, width: 1280, height: 720 });
  });
  it("derives numbering from current order with a custom start, manual label and hiding", () => {
    const master = { ...green, footer: { ...green.footer, number: { ...green.footer.number, start: 3 } } };
    expect(masterSlideNumber(master, 0)).toBe("3"); expect(masterSlideNumber(master, 2)).toBe("5");
    expect(masterSlideNumber(master, 0, { value: " A1 " })).toBe("A1");
    expect(masterSlideNumber(master, 0, { hidden: true })).toBeNull();
    expect(masterSlideNumber({ ...master, footer: { ...master.footer, number: { ...master.footer.number, visible: false } } }, 0)).toBeNull();
  });
  it("keeps the canvas usable when concurrent drafts produce a conflicting override", () => {
    const overrides = { content: { y: 620 } }, original = JSON.stringify(overrides);
    expect(renderSlideMaster(green, overrides)).toEqual(green);
    expect(() => resolveSlideMaster(green, overrides)).toThrow();
    expect(() => renderToStaticMarkup(<LearningPageSurface page={{ duration: 30, layers: [], masterOverrides: overrides }} theme={{ ...defaultSlideTheme, master: green }} />)).not.toThrow();
    expect(JSON.stringify(overrides)).toBe(original);
  });
  it("protects master regions, preserves object geometry and media trims, and renders the same scene at either resolution", () => {
    const audio = createLearningBlock("audio"); if (audio.kind !== "audio") throw new Error("Expected audio");
    const page = materializeObjectCanvas({ duration: 30, layers: [{ ...audio, start: 2, end: 8, trimStart: 3, trimEnd: 9 }, { ...createLearningBlock("text"), end: 3 }] });
    const original = JSON.stringify(page), theme = { ...defaultSlideTheme, master: green };
    const markup = renderToStaticMarkup(<LearningPageSurface page={page} theme={theme} slideTitle="Concept" slideOrder={2} time={10} />);
    expect(markup).toContain("data-master-header"); expect(markup).toContain("data-master-footer"); expect(markup).toContain("Concept"); expect(markup).toContain('data-master-number');
    expect(markup).not.toContain(`data-layer-id="${page.layers[0].id}"`); expect(markup).not.toContain(`data-layer-id="${page.layers[1].id}"`);
    expect(markup).toContain("left:44px;top:152px;width:1192px;height:452px;overflow:hidden");
    expect(renderToStaticMarkup(<LearningPageSurface page={{ ...page, resolution: "fullHd" }} theme={theme} />)).toContain("width:1920px;height:1080px");
    expect(JSON.stringify(page)).toBe(original);
    const legacy = { ...createTemplateSlide("image-text", 0), id: "legacy" }, before = JSON.stringify(legacy);
    expect(renderToStaticMarkup(<SlideSurface slide={legacy} theme={theme} />)).toContain("data-legacy-master-canvas");
    expect(JSON.stringify(legacy)).toBe(before);
  });
});
