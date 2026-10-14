/** @vitest-environment jsdom */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BlockManagerSidebar } from "../app/courses/[courseId]/edit/_components/block-manager-sidebar";
import type { ContentBlock } from "../lib/schemas/block";

const blocks: ContentBlock[] = [
  {
    id: "list-1",
    version: 1,
    type: "richText",
    width: "medium",
    widthCustom: false,
    backgroundColor: "#ffffff",
    blockPadding: 20,
    data: { html: "<ul><li><p>First choice</p></li></ul>" },
  },
  {
    id: "image-1",
    version: 1,
    type: "image",
    width: "small",
    widthCustom: false,
    backgroundColor: "#ffffff",
    blockPadding: 20,
    data: { src: "https://example.com/image.png", alt: "Course chart" },
  },
];

describe("block manager sidebar", () => {
  it("shows every block with an accessible drag handle", () => {
    const markup = renderToStaticMarkup(
      createElement(BlockManagerSidebar, {
        open: true,
        blocks,
        onClose: vi.fn(),
        onReorder: vi.fn(),
      }),
    );

    expect(markup).toContain("Manage blocks");
    expect(markup).toContain("First choice");
    expect(markup).toContain("Course chart");
    expect(markup.match(/aria-label="Drag to reorder"/g)).toHaveLength(2);
  });
});
