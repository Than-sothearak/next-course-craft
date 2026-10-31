import { describe, expect, it } from "vitest";
import { blockTemplates } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/block-template-data";
import { createBlocksFromTemplate } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/create-blocks-from-template";
import { blockSurfaceStyle, slideObjectSurfaceStyle } from "@/app/courses/[courseId]/preview/_components/(course_preview_components)/preview-utils";
import { blockSchema, blockTypes } from "@/lib/schemas/block";
import { resolveSlideBackground } from "@/lib/editor/slide-design";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { parseScorm12Snapshot } from "@/lib/scorm12/snapshot";

const blocks = [
  ...new Map(blockTemplates.flatMap((template) => createBlocksFromTemplate(template, template.id)).map((block) => [block.type, block])).values(),
  blockSchema.parse({ id: "heading", version: 1, type: "heading", data: { text: "Heading", level: 2 } }),
];
const background = { color: "#2563eb", opacity: 40 };
const text = blockSchema.parse({ id: "text", version: 1, type: "richText", backgroundColor: "#fff7ed", data: { html: "<p>Example</p>" } });

describe("presentation object backgrounds", () => {
  it("provides rounded defaults and supports square or custom corners for every block type", () => {
    for (const block of blocks) {
      expect(slideObjectSurfaceStyle(block).borderRadius).toBe("12px");
      for (const slideBorderRadius of [0, 11.23, 100]) {
        const parsed = blockSchema.parse({ ...block, slideBorderRadius });
        expect(parsed.slideBorderRadius).toBe(slideBorderRadius);
        expect(slideObjectSurfaceStyle(parsed).borderRadius).toBe(`${slideBorderRadius}px`);
      }
    }
    for (const slideBorderRadius of [-1, 101, Number.NaN, Number.POSITIVE_INFINITY, "0"]) {
      expect(blockSchema.safeParse({ ...text, slideBorderRadius }).success).toBe(false);
    }
  });

  it("covers every block type with the same validated background setting", () => {
    expect(blocks.map((block) => block.type).sort()).toEqual([...blockTypes, "lessonMap"].sort());
    for (const block of blocks) {
      expect(blockSchema.parse({ ...block, slideBackground: background }).slideBackground).toEqual(background);
    }
  });

  it.each([
    { color: "red", opacity: 50 },
    { color: "#123", opacity: 50 },
    { color: "#123456;opacity:0", opacity: 50 },
    { color: "#123456", opacity: -1 },
    { color: "#123456", opacity: 101 },
    { color: "#123456", opacity: 1.5 },
    { color: "#123456", opacity: "50" },
  ])("rejects an invalid background: %j", (slideBackground) => {
    expect(blockSchema.safeParse({ ...text, slideBackground }).success).toBe(false);
  });

  it("defaults to a transparent slide surface with the master text color and retains standard block backgrounds", () => {
    expect(resolveSlideBackground(text)).toEqual({ color: "#fff7ed", opacity: 0 });
    expect(slideObjectSurfaceStyle(text, "#0f172a", "#f8fafc")).toMatchObject({ backgroundColor: "transparent", color: "#f8fafc" });
    expect(blockSurfaceStyle(text).backgroundColor).toBe("#fff7ed");
    expect(blockSurfaceStyle({ ...text, slideBackground: background }).backgroundColor).toBe("#fff7ed");
  });

  it("applies opacity once to the fill and keeps content transparent to that fill", () => {
    const block = { ...text, slideBackground: background };
    const style = slideObjectSurfaceStyle(block);
    expect(style.backgroundColor).toBe("rgba(37, 99, 235, 0.4)");
    expect(style.opacity).toBeUndefined();
    expect(blockSurfaceStyle(block, true)).toMatchObject({ backgroundColor: "transparent", color: "inherit", paddingTop: "12px", paddingBottom: "12px" });
    expect(slideObjectSurfaceStyle({ ...text, slideBackground: { color: "#000000", opacity: 100 } })).toMatchObject({ backgroundColor: "#000000", color: "#ffffff" });
  });

  it("keeps the background in validated editor and SCORM export snapshots", () => {
    const snapshot = editorSnapshotSchema.parse({
      title: "Presentation", description: "", courseLayout: "slides", revision: 1,
      sections: [{ id: "slides", title: "Slides", order: 0 }],
      lessons: [{ id: "slide", sectionId: "slides", title: "Slide 1", order: 0, blocks: [{ ...text, slideBackground: background }] }],
    });
    expect(snapshot.lessons[0].blocks[0].slideBackground).toEqual(background);
    expect(parseScorm12Snapshot(snapshot).lessons[0].blocks[0].slideBackground).toEqual(background);
  });
});
