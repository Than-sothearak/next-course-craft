import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ImageBlockLayout } from "../app/courses/[courseId]/edit/_components/image-block-layout";
import { blockWidthClass } from "../app/courses/[courseId]/preview/_components/(course_preview_components)/preview-utils";
import { imageBlockSchema } from "../lib/schemas/block";
import { PreviewBlock } from "../app/courses/[courseId]/preview/_components/(course_preview_components)/(lesson_reader_preview_components)/(lesson_blocks_preview_components)/preview-block";
import { parseScorm12Snapshot } from "../lib/scorm12/snapshot";
import { duplicateLessonContent } from "../lib/editor/course-content";
import { remapCourseAssetUrls } from "../lib/media/asset-references";
import { SlideThumbnail } from "../app/courses/[courseId]/_components/slide-presentation/slide-thumbnail";

describe("lesson image block layouts", () => {
  it.each(["text-left", "text-right"] as const)("keeps legacy %s images covered, centered, and 4:3", (layout) => {
    const markup = renderToStaticMarkup(createElement(ImageBlockLayout, {
      layout, image: createElement("img", { src: "/image.png", alt: "Example" }),
    }));
    expect(markup).toContain('data-image-fit="cover"');
    expect(markup).toContain('data-image-position="center"');
    expect(markup).toContain('data-image-aspect-ratio="4/3"');
  });

  it.each(["full", "banner", "text-left", "text-right", "text-overlay", "card", "cover"] as const)("renders fit, placement, and ratio in the shared %s learner layout", (layout) => {
    for (const imageFit of ["cover", "contain", "fill"] as const) {
      const block = imageBlockSchema.parse({ id: "image", version: 1, type: "image", data: {
        src: "/image.png", alt: "Example", layout, imageFit, imagePosition: "bottom", imageAspectRatio: "3/4",
      } });
      const markup = renderToStaticMarkup(createElement(PreviewBlock, { block, device: "desktop", orientation: "landscape" }));
      expect(markup).toContain(`data-image-fit="${imageFit}"`);
      expect(markup).toContain(`object-${imageFit}`);
      expect(markup).toContain("object-bottom");
      expect(markup).toContain("aspect-[3/4]");
      // Frame selectors must not change the fullscreen dialog's image.
      expect(markup).not.toContain("[&amp;_img]:object-");
    }
  });

  it("keeps legacy full-image sizing and cover focal points until explicitly changed", () => {
    const full = renderToStaticMarkup(createElement(ImageBlockLayout, { image: createElement("img", { src: "/image.png", alt: "Example" }) }));
    expect(full).toContain('data-image-fit="contain"');
    expect(full).not.toContain("aspect-square");
    const cover = renderToStaticMarkup(createElement(ImageBlockLayout, { layout: "cover", coverPosition: "bottom", image: createElement("img", { src: "/image.png", alt: "Example" }) }));
    expect(cover).toContain('data-image-position="bottom"');
    expect(cover).toContain("h-72 sm:h-96");
  });

  it.each(["cover", "contain", "fill"] as const)("keeps %s fit, focal point, and ratio on plain slide images and thumbnails", (imageFit) => {
    const block = imageBlockSchema.parse({ id: "image", version: 1, type: "image", data: {
      src: "/image.png", alt: "Example", imageFit, imagePosition: "top", imageAspectRatio: "1/1",
    } });
    for (const markup of [
      renderToStaticMarkup(createElement(PreviewBlock, { block, device: "desktop", orientation: "landscape", slideLayout: true })),
      renderToStaticMarkup(createElement(SlideThumbnail, { slide: { id: "slide", title: "Slide", blocks: [block] }, index: 0 })),
    ]) {
      expect(markup).toContain(`object-fit:${imageFit}`);
      expect(markup).toContain("object-position:top");
      expect(markup).toContain('data-image-aspect-ratio="1/1"');
    }
  });

  it("preserves split-image settings through duplication and static export validation/remapping", () => {
    const snapshot = parseScorm12Snapshot({ title: "Images", description: "", revision: 0,
      sections: [{ id: "s", title: "Section", order: 0 }],
      lessons: [{ id: "l", sectionId: "s", title: "Lesson", order: 0, blocks: [{ id: "image", version: 1, type: "image", data: {
        src: "/api/assets/507f1f77bcf86cd799439011/file", alt: "Example", layout: "text-left", imageFit: "contain", imagePosition: "right", imageAspectRatio: "16/9",
      } }] }],
    });
    let nextId = 0;
    const duplicate = duplicateLessonContent(snapshot.lessons[0], () => `copy-${nextId++}`);
    duplicate.order = 1;
    const packaged = remapCourseAssetUrls(parseScorm12Snapshot({ ...snapshot, lessons: [...snapshot.lessons, duplicate] }), new Map([["507f1f77bcf86cd799439011", "assets/image.png"]]));
    expect(packaged.lessons).toHaveLength(2);
    for (const lesson of packaged.lessons) expect(lesson.blocks[0]).toMatchObject({ data: {
      src: "assets/image.png", imageFit: "contain", imagePosition: "right", imageAspectRatio: "16/9",
    } });
  });

  it.each([{ imageFit: "invalid" }, { imagePosition: "outside" }, { imageAspectRatio: "100/0" }])("rejects invalid split-image settings %j", (settings) => {
    expect(imageBlockSchema.safeParse({ id: "image", version: 1, type: "image", data: { src: "/image.png", alt: "Example", ...settings } }).success).toBe(false);
  });

  it("renders an editable text and image split layout", () => {
    const markup = renderToStaticMarkup(createElement(ImageBlockLayout, {
      layout: "text-left",
      title: "Explain the idea",
      body: "Describe what learners should notice.",
      image: createElement("img", { src: "/lesson-image.png", alt: "Example" }),
    }));

    expect(markup).toContain("md:grid-cols-2");
    expect(markup).toContain("aspect-[4/3]");
    expect(markup).toContain("Explain the idea");
    expect(markup).toContain("Describe what learners should notice.");
    expect(markup).toContain("/lesson-image.png");
  });

  it("places title and body fields inside the image layout in editor mode", () => {
    const markup = renderToStaticMarkup(createElement(ImageBlockLayout, {
      layout: "card",
      title: "Editable title",
      body: "Editable supporting text.",
      editable: true,
      onTitleChange: () => {},
      onBodyChange: () => {},
      image: createElement("img", { src: "/lesson-image.png", alt: "Example" }),
    }));

    expect(markup).toContain('aria-label="Image block title"');
    expect(markup).toContain('aria-label="Image block text"');
    expect(markup).toContain("Editable title");
    expect(markup).toContain("Editable supporting text.");
  });

  it("supports overlay, card, and banner visual treatments", () => {
    const render = (layout: "text-overlay" | "card" | "banner") => renderToStaticMarkup(createElement(ImageBlockLayout, {
      layout,
      title: "Visual introduction",
      body: "Set the scene for this lesson.",
      image: createElement("img", { src: "/lesson-image.png", alt: "Example" }),
    }));

    expect(render("text-overlay")).toContain("bg-gradient-to-t");
    expect(render("text-overlay")).toContain("Visual introduction");
    expect(render("card")).toContain("rounded-2xl border");
    expect(render("card")).toContain("Visual introduction");
    expect(render("banner")).toContain("aspect-[21/9]");
  });

  it("renders a full-width cover with a selected focal point, height, overlay, and editable copy", () => {
    const block = imageBlockSchema.parse({
      id: "cover",
      version: 1,
      type: "image",
      data: {
        src: "/lesson-cover.png",
        alt: "Mountain landscape",
        layout: "cover",
        coverHeight: "tall",
        coverPosition: "bottom",
        coverOverlayOpacity: 60,
      },
    });
    const markup = renderToStaticMarkup(createElement(ImageBlockLayout, {
      layout: "cover",
      title: "Course introduction",
      body: "A short message over the cover image.",
      caption: "Image source",
      coverHeight: "tall",
      coverPosition: "bottom",
      coverOverlayOpacity: 60,
      coverContentWidth: "full",
      editable: true,
      onTitleChange: () => {},
      onBodyChange: () => {},
      image: createElement("img", { src: "/lesson-cover.png", alt: "Mountain landscape" }),
    }));

    expect(markup).toContain('data-image-layout="cover"');
    expect(markup).toContain('data-cover-height="tall"');
    expect(markup).toContain("h-[22rem] sm:h-[32rem]");
    expect(markup).toContain("object-bottom");
    expect(markup).toContain("opacity:0.6");
    expect(markup).toContain('data-cover-content-width="full"');
    expect(markup).toContain("max-w-[920px]");
    expect(markup).toContain('aria-label="Image block title"');
    expect(markup).toContain("Course introduction");
    expect(markup).toContain("mx-auto w-full max-w-[920px] px-4");
    expect(markup).not.toContain("max-w-3xl");
    expect(markup).toContain("Image source");
    expect(blockWidthClass(block)).toBe("max-w-none");
  });

  it.each([
    ["small", "max-w-[520px]"],
    ["medium", "max-w-[720px]"],
    ["full", "max-w-[920px]"],
  ] as const)("sets the cover copy to %s content width without changing the full-bleed image", (coverContentWidth, widthClass) => {
    const markup = renderToStaticMarkup(createElement(ImageBlockLayout, {
      layout: "cover",
      title: "Course introduction",
      coverContentWidth,
      image: createElement("img", { src: "/lesson-cover.png", alt: "Mountain landscape" }),
    }));

    expect(markup).toContain(`data-cover-content-width="${coverContentWidth}"`);
    expect(markup).toContain(widthClass);
    expect(markup).toContain('class="relative isolate w-full overflow-hidden');
  });
});
