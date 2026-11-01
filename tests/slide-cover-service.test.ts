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
  it("verifies per-slide background images against ready ownership in this course", async () => {
    const slides = lesson(""); slides[0].slideCover = undefined;
    slides[0].slideAppearance = { hideHeader: true, hideFooter: true, background: { type: "image", imageSrc: "/api/assets/123456789012345678901234/file", imagePosition: "center", overlayOpacity: 0 } };
    await assertSlideCoverAssets("owner", "course", slides);
    expect(findOne).toHaveBeenCalledWith({ _id: "123456789012345678901234", ownerId: "owner", courseId: "course", status: "ready", mimeType: /^image\// });
    lean.mockResolvedValue(null);
    await expect(assertSlideCoverAssets("owner", "course", slides)).rejects.toThrow("slide background image");
    for (const imageSrc of ["./media/background.png", "data:image/png;base64,YQ=="]) {
      slides[0].slideAppearance.background = { type: "image", imageSrc, imagePosition: "center", overlayOpacity: 0 };
      await expect(assertSlideCoverAssets("owner", "course", slides)).rejects.toThrow("media library");
    }
  });
  it("verifies ready audio ownership and rejects missing, foreign, and offline audio sources", async () => {
    const lessons = lesson("");
    lessons[0].slideCover!.instructions = { audioSrc: "/api/assets/123456789012345678901234/file", audioName: "Intro.mp3", audioTrigger: "start", noticeEnabled: false, noticeTitle: "Welcome", noticeText: "Start here", noticeTrigger: "cover", firstVisitOnly: true };
    await assertSlideCoverAssets("owner", "course", lessons);
    expect(findOne).toHaveBeenCalledWith({ _id: "123456789012345678901234", ownerId: "owner", courseId: "course", status: "ready", mimeType: /^audio\// });
    lean.mockResolvedValue(null);
    await expect(assertSlideCoverAssets("owner", "course", lessons)).rejects.toThrow("instruction audio");
    for (const audioSrc of ["./media/intro.mp3", "data:audio/mpeg;base64,YQ=="]) {
      lessons[0].slideCover!.instructions.audioSrc = audioSrc;
      await expect(assertSlideCoverAssets("owner", "course", lessons)).rejects.toThrow("instruction audio");
    }
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
