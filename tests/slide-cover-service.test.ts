import { beforeEach, describe, expect, it, vi } from "vitest";
import { editorSnapshotSchema } from "@/lib/editor/schemas";

const { findOne, lean } = vi.hoisted(() => ({ findOne: vi.fn(), lean: vi.fn() }));
vi.mock("@/models/Asset", () => ({ Asset: { findOne } }));
import { assertSlideCoverAssets } from "@/lib/editor/services/slide-cover-assets";

const lesson = (imageSrc: string) => editorSnapshotSchema.parse({
  title: "Presentation", description: "", revision: 0, courseLayout: "slides",
  sections: [{ id: "section", title: "Slides", order: 0 }],
  lessons: [{ id: "first", sectionId: "section", title: "Cover", order: 0, blocks: [], slideCover: { template: "imageCover", imageSrc } }],
}).lessons;

describe("presentation cover image ownership", () => {
  beforeEach(() => { vi.clearAllMocks(); findOne.mockReturnValue({ select: () => ({ lean }) }); lean.mockResolvedValue({ _id: "123456789012345678901234" }); });
  it("accepts only a ready image in the author's course", async () => {
    await assertSlideCoverAssets("owner", "course", lesson("/api/assets/123456789012345678901234/file"));
    expect(findOne).toHaveBeenCalledWith({ _id: "123456789012345678901234", ownerId: "owner", courseId: "course", status: "ready", mimeType: /^image\// });
  });
  it("rejects external or missing cover images", async () => {
    expect(() => lesson("https://example.com/image.png")).toThrow("media library");
    lean.mockResolvedValue(null);
    await expect(assertSlideCoverAssets("owner", "course", lesson("/api/assets/123456789012345678901234/file"))).rejects.toThrow("media library");
  });
  it("keeps image-free cover slides valid", async () => {
    await assertSlideCoverAssets("owner", "course", lesson(""));
    expect(findOne).not.toHaveBeenCalled();
  });
  it("rejects blocks hidden behind a cover", () => {
    const parsed = editorSnapshotSchema.safeParse({
      title: "Presentation", description: "", revision: 0, courseLayout: "slides",
      sections: [{ id: "section", title: "Slides", order: 0 }],
      lessons: [{ id: "first", sectionId: "section", title: "Cover", order: 0, slideCover: { template: "imageCover" }, blocks: [{ id: "heading", version: 1, type: "heading", data: { text: "Hidden", level: 1 } }] }],
    });
    expect(parsed.success).toBe(false);
  });
});
