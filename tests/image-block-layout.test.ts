import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ImageBlockLayout } from "../app/courses/[courseId]/edit/_components/image-block-layout";

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
});
