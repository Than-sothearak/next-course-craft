/** @vitest-environment jsdom */
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SlideMasterBackground } from "@/app/courses/[courseId]/_components/slide-presentation/slide-master-background";
import { SlideHeaderBackground } from "@/app/courses/[courseId]/_components/slide-presentation/slide-header-background";
import { SlideCoverSurface } from "@/app/courses/[courseId]/_components/slide-presentation/slide-cover-surface";
import { SlideMediaObject } from "@/app/courses/[courseId]/_components/slide-presentation/slide-media-object";
import { SlideThumbnail } from "@/app/courses/[courseId]/_components/slide-presentation/slide-thumbnail";
import { SlideMediaOverlayControls } from "@/app/courses/[courseId]/edit/presentation-mode/_components/slide-presentation/slide-media-overlay-controls";
import { SlideMasterBackgroundControls } from "@/app/courses/[courseId]/edit/presentation-mode/_components/slide-presentation/slide-master-background-controls";
import { slideCoverSchema, slideMasterSchema } from "@/lib/editor/slide-design";
import { blockSchema, type ContentBlock } from "@/lib/schemas/block";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { parseScorm12Snapshot } from "@/lib/scorm12/snapshot";
import { courseAssetIds, remapCourseAssetUrls } from "@/lib/media/asset-references";
import { Course } from "@/models/Course";
import { Lesson } from "@/models/Lesson";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const assetId = "123456789012345678901234", source = `/api/assets/${assetId}/file`;
const gradient = "linear-gradient(135deg, #2563eb 0%, #f97316 100%)";
const makeMedia = (type: "image" | "video", color = "#123456") => blockSchema.parse({ id: type, version: 1, type, slideMediaOverlay: { color, opacity: 40 }, data: { src: source, ...(type === "video" ? { mimeType: "video/mp4" } : { alt: "Image" }) } });
const makeSnapshot = () => editorSnapshotSchema.parse({ title: "Overlays", description: "", revision: 0, courseLayout: "slides",
  slideMaster: { background: { type: "image", imageSrc: source, overlayColor: gradient }, header: { background: "image", imageSrc: source, overlayColor: "#123456" } },
  sections: [{ id: "section", title: "Slides", order: 0 }],
  lessons: [
    { id: "slide", sectionId: "section", title: "Media", order: 0, blocks: [makeMedia("image"), makeMedia("video", gradient)], slideAppearance: { background: { type: "image", imageSrc: source, overlayColor: "#654321" } } },
    { id: "cover", sectionId: "section", title: "Cover", order: 1, blocks: [], slideCover: { template: "imageCover", imageSrc: source, overlayColor: "#abcdef" } },
  ],
});

function overlays(markup: string) {
  const element = document.createElement("div"); element.innerHTML = markup;
  return [...element.querySelectorAll<HTMLElement>("[data-slide-color-overlay]")];
}

describe("presentation media color overlays", () => {
  it.each(["red", "#123", "url(https://example.com)", "#123456;opacity:0"])("rejects unsafe overlay colors (%s) at every entry point", (color) => {
    expect(blockSchema.safeParse({ ...makeMedia("video"), slideMediaOverlay: { color, opacity: 40 } }).success).toBe(false);
    expect(slideMasterSchema.safeParse({ background: { type: "image", overlayColor: color } }).success).toBe(false);
    expect(slideMasterSchema.safeParse({ header: { overlayColor: color } }).success).toBe(false);
    expect(slideCoverSchema.safeParse({ template: "imageCover", overlayColor: color }).success).toBe(false);
  });

  it.each([-1, 101, 10.5, "40"])("rejects invalid media opacity (%s)", (opacity) => {
    expect(blockSchema.safeParse({ ...makeMedia("image"), slideMediaOverlay: { color: "#123456", opacity } }).success).toBe(false);
  });

  it("keeps the previous overlay colors until an independent color is selected", () => {
    const master = slideMasterSchema.parse({ backgroundColor: "#123456", background: { type: "image", imageSrc: source }, header: { background: "image", backgroundColor: "#654321", imageSrc: source } });
    expect(overlays(renderToStaticMarkup(<SlideMasterBackground master={master} />))[0].style.backgroundColor).toBe("rgb(18, 52, 86)");
    expect(overlays(renderToStaticMarkup(<SlideHeaderBackground master={master} />))[0].style.backgroundColor).toBe("rgb(101, 67, 33)");
    expect(overlays(renderToStaticMarkup(<SlideCoverSurface cover={slideCoverSchema.parse({ template: "imageCover" })} title="Cover" />))[0].style.backgroundColor).toBe("rgb(4, 10, 32)");
    const plain = makeMedia("image");
    if (plain.type !== "image") throw new Error("Expected image");
    expect(overlays(renderToStaticMarkup(<SlideMediaObject block={{ ...plain, slideMediaOverlay: undefined }} />))).toHaveLength(0);
  });

  it.each(["image", "video"] as const)("renders a %s overlay in preview and thumbnails without fading the media element", (type) => {
    const block = makeMedia(type, gradient);
    if (block.type !== "image" && block.type !== "video") throw new Error("Expected media");
    for (const markup of [renderToStaticMarkup(<SlideMediaObject block={block} />), renderToStaticMarkup(<SlideThumbnail slide={{ id: "slide", title: "Media", blocks: [block] }} index={0} />)]) {
      const overlay = overlays(markup)[0];
      expect(overlay.style.backgroundImage).toBe(gradient);
      expect(overlay.style.opacity).toBe("0.4");
      expect(overlay.classList.contains("pointer-events-none")).toBe(true);
      const media = overlay.parentElement!.querySelector<HTMLElement>(type === "image" ? "img" : "video")!;
      expect(media.style.opacity).toBe("");
    }
  });

  it("preserves independent overlay colors in database documents and offline snapshots", () => {
    const snapshot = makeSnapshot();
    const course = new Course({ ownerId: assetId, title: snapshot.title, slideMaster: snapshot.slideMaster });
    expect(course.validateSync()).toBeUndefined();
    expect(slideMasterSchema.parse(course.toObject().slideMaster)).toEqual(snapshot.slideMaster);
    const slide = snapshot.lessons[0];
    const lesson = new Lesson({ courseId: assetId, editorId: slide.id, sectionId: slide.sectionId, order: 0, blocks: slide.blocks, slideAppearance: slide.slideAppearance });
    expect(lesson.validateSync()).toBeUndefined();
    expect(lesson.toObject().blocks).toEqual(slide.blocks);
    expect(lesson.toObject().slideAppearance).toEqual(slide.slideAppearance);
    const cover = new Lesson({ courseId: assetId, editorId: "cover", sectionId: slide.sectionId, order: 1, slideCover: snapshot.lessons[1].slideCover });
    expect(cover.validateSync()).toBeUndefined();
    expect(cover.toObject().slideCover).toEqual(snapshot.lessons[1].slideCover);
    expect([...courseAssetIds(snapshot)]).toEqual([assetId]);
    const packaged = remapCourseAssetUrls(parseScorm12Snapshot(snapshot), new Map([[assetId, "./media/media.mp4"]]));
    expect(packaged.slideMaster?.background).toMatchObject({ overlayColor: gradient, imageSrc: "./media/media.mp4" });
    expect(packaged.slideMaster?.header?.overlayColor).toBe("#123456");
    expect(packaged.lessons[0].slideAppearance?.background).toMatchObject({ overlayColor: "#654321" });
    expect(packaged.lessons[1].slideCover?.overlayColor).toBe("#abcdef");
    expect(packaged.lessons[0].blocks.map((block) => block.slideMediaOverlay)).toEqual(slide.blocks.map((block) => block.slideMediaOverlay));
    expect([...courseAssetIds(packaged)]).toEqual([]);
  });

  it("paints chosen overlay colors independently of the background colors", () => {
    const master = slideMasterSchema.parse({ backgroundColor: "#ffffff", background: { type: "image", imageSrc: source, overlayColor: gradient, overlayOpacity: 45 }, header: { background: "image", imageSrc: source, overlayColor: gradient, overlayOpacity: 60 } });
    const cover = slideCoverSchema.parse({ template: "imageCover", overlayColor: gradient, overlayOpacity: 25 });
    const layers = [renderToStaticMarkup(<SlideMasterBackground master={master} />), renderToStaticMarkup(<SlideHeaderBackground master={master} />), renderToStaticMarkup(<SlideCoverSurface cover={cover} title="Cover" />)].map((markup) => overlays(markup)[0]);
    expect(layers.map((layer) => layer.style.backgroundImage)).toEqual([gradient, gradient, gradient]);
    expect(layers.map((layer) => layer.style.opacity)).toEqual(["0.45", "0.6", "0.25"]);
  });

  it("edits the master image overlay without changing the master fill", async () => {
    const container = document.createElement("div"); document.body.append(container); const root = createRoot(container);
    let saved = slideMasterSchema.parse({ backgroundColor: "#ffffff", background: { type: "image", imageSrc: source } });
    function Fixture() {
      const [master, setMaster] = useState(saved);
      return <SlideMasterBackgroundControls master={master} courseId="course" onChange={(next) => { saved = slideMasterSchema.parse(next); setMaster(saved); }} />;
    }
    try {
      await act(async () => root.render(<Fixture />));
      const element = container.querySelector<HTMLInputElement>('[aria-label="Master background overlay color hex code"]')!;
      await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, "#ff8800"); element.dispatchEvent(new Event("input", { bubbles: true })); });
      expect(saved.background).toMatchObject({ overlayColor: "#ff8800", overlayOpacity: 30 });
      expect(saved.backgroundColor).toBe("#ffffff");
      expect(container.querySelector<HTMLElement>("[data-slide-color-overlay]")?.style.backgroundColor).toBe("rgb(255, 136, 0)");
    } finally { act(() => root.unmount()); container.remove(); }
  });

  it.each(["image", "video"] as const)("edits and removes a %s overlay through the configured controls", async (type) => {
    const container = document.createElement("div"); document.body.append(container); const root = createRoot(container);
    let saved: ContentBlock = makeMedia(type);
    function Fixture() {
      const [block, setBlock] = useState(saved);
      return <SlideMediaOverlayControls block={block} onChange={(next) => { saved = blockSchema.parse(next); setBlock(saved); }} />;
    }
    const input = async (label: string, value: string) => act(async () => {
      const element = container.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, value);
      element.dispatchEvent(new Event("input", { bubbles: true }));
    });
    try {
      await act(async () => root.render(<Fixture />));
      await input("Media overlay color hex code", "#ff8800");
      await input("Media overlay opacity", "65");
      expect(saved.slideMediaOverlay).toEqual({ color: "#ff8800", opacity: 65 });
      await act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === "Remove media overlay")!.click());
      expect(saved.slideMediaOverlay).toBeUndefined();
      expect(container.querySelector<HTMLInputElement>('[aria-label="Media overlay opacity"]')?.value).toBe("0");
    } finally { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); }
  });
});
