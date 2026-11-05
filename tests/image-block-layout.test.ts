import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ImageBlockLayout } from "../app/courses/[courseId]/edit/_components/image-block-layout";
import { blockWidthClass } from "../app/courses/[courseId]/preview/_components/(course_preview_components)/preview-utils";
import { imageBlockSchema } from "../lib/schemas/block";

describe("lesson image block layouts", () => {
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
