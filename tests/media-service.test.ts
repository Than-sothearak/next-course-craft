import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findOne: vi.fn(),
  deleteOne: vi.fn(),
  deleteMediaObject: vi.fn(),
}));

vi.mock("@/models/Asset", () => ({ Asset: { findOne: mocks.findOne, deleteOne: mocks.deleteOne } }));
vi.mock("@/lib/media/storage", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/media/storage")>(),
  deleteMediaObject: mocks.deleteMediaObject,
}));

import { deleteCourseMediaAsset } from "@/lib/media/services/course-assets";

describe("course media deletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findOne.mockResolvedValue({ _id: "asset-1", objectKey: "owner-1/course-1/asset-1" });
    mocks.deleteMediaObject.mockResolvedValue(undefined);
    mocks.deleteOne.mockResolvedValue({ deletedCount: 1 });
  });

  it("deletes the S3 object before removing the owner-scoped asset record", async () => {
    await deleteCourseMediaAsset("owner-1", "course-1", "asset-1");

    expect(mocks.findOne).toHaveBeenCalledWith({ _id: "asset-1", ownerId: "owner-1", courseId: "course-1", status: "ready" });
    expect(mocks.deleteMediaObject).toHaveBeenCalledWith("owner-1/course-1/asset-1");
    expect(mocks.deleteOne).toHaveBeenCalledWith({ _id: "asset-1", ownerId: "owner-1", courseId: "course-1" });
  });

  it("keeps the asset record when S3 deletion fails", async () => {
    mocks.deleteMediaObject.mockRejectedValue(new Error("S3 unavailable"));

    await expect(deleteCourseMediaAsset("owner-1", "course-1", "asset-1")).rejects.toThrow("The file could not be deleted from storage.");
    expect(mocks.deleteOne).not.toHaveBeenCalled();
  });

  it("does not delete an asset owned by another course or user", async () => {
    mocks.findOne.mockResolvedValue(null);

    await expect(deleteCourseMediaAsset("owner-1", "course-1", "asset-1")).rejects.toThrow("Media asset not found.");
    expect(mocks.deleteMediaObject).not.toHaveBeenCalled();
    expect(mocks.deleteOne).not.toHaveBeenCalled();
  });
});
