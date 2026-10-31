import { beforeEach, describe, expect, it, vi } from "vitest";
import { slideMasterSchema } from "@/lib/editor/slide-design";

const { findOne, lean } = vi.hoisted(() => ({ findOne: vi.fn(), lean: vi.fn() }));
vi.mock("@/models/Asset", () => ({ Asset: { findOne } }));
import { assertSlideMasterAsset } from "@/lib/editor/services/slide-master-assets";

const master = (imageSrc: string) => slideMasterSchema.parse({ background: { type: "image", imageSrc } });

describe("master background image ownership", () => {
  beforeEach(() => { vi.clearAllMocks(); findOne.mockReturnValue({ select: () => ({ lean }) }); lean.mockResolvedValue({ _id: "123456789012345678901234" }); });
  it("accepts a ready image owned by the author in this course", async () => {
    await assertSlideMasterAsset("owner", "course", master("/api/assets/123456789012345678901234/file"));
    expect(findOne).toHaveBeenCalledWith({ _id: "123456789012345678901234", ownerId: "owner", courseId: "course", status: "ready", mimeType: /^image\// });
  });
  it("rejects unavailable or foreign images", async () => {
    lean.mockResolvedValue(null);
    await expect(assertSlideMasterAsset("owner", "course", master("/api/assets/123456789012345678901234/file"))).rejects.toThrow("this course's media library");
  });
  it.each(["./media/image.png", "data:image/png;base64,YQ=="])("rejects an offline source on author saves (%s)", async (source) => {
    await expect(assertSlideMasterAsset("owner", "course", master(source))).rejects.toThrow("media library");
    expect(findOne).not.toHaveBeenCalled();
  });
  it("allows themes, designs, and empty image selections without querying assets", async () => {
    await assertSlideMasterAsset("owner", "course");
    await assertSlideMasterAsset("owner", "course", slideMasterSchema.parse({ background: { type: "abstract", design: "waves" } }));
    await assertSlideMasterAsset("owner", "course", master(""));
    expect(findOne).not.toHaveBeenCalled();
  });

  it("verifies footer logo ownership and deduplicates shared master images", async () => {
    const src = "/api/assets/123456789012345678901234/file";
    const value = slideMasterSchema.parse({ background: { type: "image", imageSrc: src }, footer: { content: "logos", logos: [{ id: "one", src }, { id: "two", src }] } });
    await assertSlideMasterAsset("owner", "course", value);
    expect(findOne).toHaveBeenCalledTimes(1);
    expect(findOne).toHaveBeenCalledWith({ _id: "123456789012345678901234", ownerId: "owner", courseId: "course", status: "ready", mimeType: /^image\// });
  });

  it("rejects missing or foreign footer logos", async () => {
    lean.mockResolvedValue(null);
    const value = slideMasterSchema.parse({ footer: { content: "logos", logos: [{ id: "brand", src: "/api/assets/123456789012345678901234/file" }] } });
    await expect(assertSlideMasterAsset("owner", "course", value)).rejects.toThrow("footer logos");
  });

  it("checks header image ownership and deduplicates images shared with other master settings", async () => {
    const src = "/api/assets/123456789012345678901234/file";
    const value = slideMasterSchema.parse({ header: { background: "image", imageSrc: src }, background: { type: "image", imageSrc: src } });
    await assertSlideMasterAsset("owner", "course", value);
    expect(findOne).toHaveBeenCalledTimes(1);
    expect(findOne).toHaveBeenCalledWith({ _id: "123456789012345678901234", ownerId: "owner", courseId: "course", status: "ready", mimeType: /^image\// });
    lean.mockResolvedValue(null);
    await expect(assertSlideMasterAsset("owner", "course", slideMasterSchema.parse({ header: { imageSrc: src } }))).rejects.toThrow("header background image");
  });

  it.each(["./media/header.png", "data:image/png;base64,YQ=="])("rejects offline header image sources on author saves (%s)", async (imageSrc) => {
    await expect(assertSlideMasterAsset("owner", "course", slideMasterSchema.parse({ header: { background: "image", imageSrc } }))).rejects.toThrow("header background image");
    expect(findOne).not.toHaveBeenCalled();
  });

  it.each(["./media/logo.png", "data:image/png;base64,YQ=="])("rejects offline logo sources when saving (%s)", async (src) => {
    const value = slideMasterSchema.parse({ footer: { logos: [{ id: "brand", src }] } });
    await expect(assertSlideMasterAsset("owner", "course", value)).rejects.toThrow("footer logos");
    expect(findOne).not.toHaveBeenCalled();
  });
});
