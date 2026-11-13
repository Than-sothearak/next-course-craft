import { beforeEach, describe, expect, it, vi } from "vitest";
import { courseThemeSchema } from "../lib/editor/theme";
import { courseCoverSchema } from "../lib/editor/course-cover";

const { findOne, lean, exists } = vi.hoisted(() => ({ findOne: vi.fn(), lean: vi.fn(), exists: vi.fn() }));
vi.mock("../models/Asset", () => ({ Asset: { findOne, exists } }));
import { assertCourseCoverAsset, restoreLegacyGeneratedCourseCover } from "../lib/editor/services/course-cover";

describe("course cover image ownership", () => {
  beforeEach(() => { vi.clearAllMocks(); findOne.mockReturnValue({ select: () => ({ lean }) }); lean.mockResolvedValue({ _id: "123456789012345678901234" }); });
  it("accepts a ready image only from the current owner's course", async () => {
    await assertCourseCoverAsset("owner", "course", courseCoverSchema.parse({ template: "image", imageSrc: "/api/assets/123456789012345678901234/file" }));
    expect(findOne).toHaveBeenCalledWith({ _id: "123456789012345678901234", ownerId: "owner", courseId: "course", status: "ready", mimeType: /^image\// });
  });
  it("rejects images from another course/user, missing assets, and non-images", async () => {
    lean.mockResolvedValue(null);
    await expect(assertCourseCoverAsset("owner", "course", courseCoverSchema.parse({ template: "image", imageSrc: "/api/assets/123456789012345678901234/file" }))).rejects.toThrow("this course’s media library");
  });
  it("rejects export-only embedded images on the save path", async () => {
    await expect(assertCourseCoverAsset("owner", "course", courseCoverSchema.parse({ template: "image", imageSrc: "data:image/png;base64,aGVsbG8=" }))).rejects.toThrow("media library");
    expect(findOne).not.toHaveBeenCalled();
  });
  it("does not require media for a designed cover or an older theme", async () => {
    await assertCourseCoverAsset("owner", "course");
    await assertCourseCoverAsset("owner", "course", courseCoverSchema.parse({ template: "waves" }));
    expect(findOne).not.toHaveBeenCalled();
  });
});


describe("legacy generated learner-cover compatibility", () => {
  it("removes only a marked generated learner cover and keeps other theme settings", async () => {
    exists.mockResolvedValue({ _id: "123456789012345678901234" });
    const theme = courseThemeSchema.parse({ primaryColor: "#123456", cover: { template: "image", imageSrc: "/api/assets/123456789012345678901234/file", titleOnly: true } });
    const restored = await restoreLegacyGeneratedCourseCover("owner", "course", theme);
    expect(restored.cover).toBeUndefined(); expect(restored.primaryColor).toBe("#123456");
    expect(theme.cover).toBeDefined();
    expect(exists).toHaveBeenCalledWith({ _id: "123456789012345678901234", ownerId: "owner", courseId: "course", "metadata.purpose": "course-cover" });
  });
  it("preserves manually selected images even when a legacy title flag is present", async () => {
    exists.mockResolvedValue(null);
    const theme = courseThemeSchema.parse({ cover: { template: "image", imageSrc: "/api/assets/123456789012345678901234/file", titleOnly: true } });
    expect(await restoreLegacyGeneratedCourseCover("owner", "course", theme)).toBe(theme);
  });
});
