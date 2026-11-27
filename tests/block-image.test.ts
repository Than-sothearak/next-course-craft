import { describe, expect, it } from "vitest";
import { blockSchema, richTextBlockSchema } from "@/lib/schemas/block";
import { blockImageInstructions, insertBlockImage } from "@/lib/editor/block-image";
import { parseScorm12Snapshot } from "@/lib/scorm12/snapshot";
import { remapCourseAssetUrls } from "@/lib/media/asset-references";

const source = richTextBlockSchema.parse({ id: "source", version: 1, type: "richText", data: { html: '<p>Build a page</p><pre><code>&lt;h1&gt;Hello&lt;/h1&gt;</code></pre><p>Set color to blue.</p>' } });
const next = blockSchema.parse({ id: "next", version: 1, type: "heading", data: { text: "Next topic", level: 2 } });
const assetId = "507f1f77bcf86cd799439013";
const media = { src: `/api/assets/${assetId}/file`, fileName: "generated.webp", mimeType: "image/webp" as const, size: 150_000 };

describe("block image generation content and insertion", () => {
  it("extracts readable current content while retaining literal code and structured data", () => {
    expect(blockImageInstructions(source)).toContain("<h1>Hello</h1>");
    expect(blockImageInstructions(source)).toContain("Set color to blue.");
    expect(blockImageInstructions(source)).not.toContain("<p>");
    const table = blockSchema.parse({ id: "table", version: 1, type: "table", data: { caption: "Sales", columns: ["Year", "Total"], rows: [["2026", "25"]] } });
    expect(blockImageInstructions(table)).toBe("Sales\nYear | Total\n2026 | 25");
    const steps = blockSchema.parse({ id: "steps", version: 1, type: "processSteps", data: { steps: [{ id: "one", title: "Prepare", body: "Old", bodyHtml: "<p>Current instructions</p>" }, { id: "two", title: "Finish", body: "Review" }] } });
    expect(blockImageInstructions(steps)).toContain("Current instructions");
    expect(blockImageInstructions(steps)).not.toContain("Old");
  });

  it("bounds long content and leaves empty blocks available for custom instructions", () => {
    expect(blockImageInstructions({ ...source, data: { html: `<p>${"x".repeat(6000)}</p>` } })).toHaveLength(5000);
    expect(blockImageInstructions({ ...source, data: { html: "<p></p>" } })).toBe("");
    const audio = blockSchema.parse({ id: "audio", type: "audio", version: 1, data: { src: "", mimeType: "audio/mpeg" } });
    expect(blockImageInstructions(audio)).toBe("");
  });

  it("inserts a medium 16:9 image with caption directly after the current source position", () => {
    const original = [next, source];
    const result = insertBlockImage(original, source.id, media, "generated");
    expect(result.map((block) => block.id)).toEqual(["next", "source", "generated"]);
    expect(result[2]).toMatchObject({ type: "image", width: "medium", widthCustom: true, data: { src: media.src, alt: "Build a page", caption: "Build a page", layout: "full", imageFit: "contain", imageAspectRatio: "16/9" } });
    expect(original).toEqual([next, source]);
    expect(insertBlockImage([source, next], source.id, media, "generated").map((block) => block.id)).toEqual(["source", "generated", "next"]);
  });

  it("rejects removed sources, full lessons and non-image media", () => {
    expect(() => insertBlockImage([next], source.id, media, "generated")).toThrow("source block was removed");
    expect(() => insertBlockImage(Array.from({ length: 500 }, (_, index) => ({ ...source, id: index === 0 ? source.id : `block-${index}` })), source.id, media, "generated")).toThrow("500 blocks");
    expect(() => insertBlockImage([source], source.id, { ...media, mimeType: "video/mp4" }, "generated")).toThrow("Choose a generated image");
  });

  it("uses the existing static export schema and asset remapping", () => {
    const blocks = insertBlockImage([source], source.id, media, "generated");
    const snapshot = parseScorm12Snapshot({ title: "Course", description: "", revision: 0,
      sections: [{ id: "s", title: "Section", order: 0 }],
      lessons: [{ id: "l", sectionId: "s", title: "Lesson", order: 0, blocks }],
    });
    const packaged = remapCourseAssetUrls(snapshot, new Map([[assetId, "assets/generated.webp"]]));
    expect(packaged.lessons[0].blocks[1]).toMatchObject({ type: "image", data: { src: "assets/generated.webp", caption: "Build a page", imageAspectRatio: "16/9" } });
  });
});
