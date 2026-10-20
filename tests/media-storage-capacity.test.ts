import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ statfs: vi.fn() }));
vi.mock("node:fs/promises", async (importOriginal) => ({
  ...await importOriginal<typeof import("node:fs/promises")>(),
  statfs: mocks.statfs,
}));

import { getLocalStorageCapacity } from "@/lib/media/capacity";

beforeEach(() => vi.clearAllMocks());

describe("local storage capacity", () => {
  it("returns total and process-available bytes for the selected volume", async () => {
    mocks.statfs.mockResolvedValue({ blocks: BigInt(100), bfree: BigInt(70), bsize: BigInt(4096), bavail: BigInt(25) });

    await expect(getLocalStorageCapacity("/data/coursecraft/uploads")).resolves.toEqual({
      totalBytes: 409_600,
      freeBytes: 102_400,
      usedBytes: 122_880,
    });
    expect(mocks.statfs).toHaveBeenCalledWith("/data/coursecraft/uploads", { bigint: true });
  });

  it("does not count filesystem-reserved free blocks as used space", async () => {
    mocks.statfs.mockResolvedValue({ blocks: BigInt(100), bfree: BigInt(60), bsize: BigInt(4096), bavail: BigInt(45) });

    await expect(getLocalStorageCapacity("/data/coursecraft/uploads")).resolves.toMatchObject({
      usedBytes: 40 * 4096,
      freeBytes: 45 * 4096,
    });
  });

  it("returns no capacity for missing or unreadable folders without failing settings", async () => {
    await expect(getLocalStorageCapacity(null)).resolves.toBeNull();
    expect(mocks.statfs).not.toHaveBeenCalled();

    mocks.statfs.mockRejectedValue(new Error("Permission denied"));
    await expect(getLocalStorageCapacity("/data/coursecraft/uploads")).resolves.toBeNull();
  });

  it("rejects values that cannot be represented safely by the JSON API", async () => {
    mocks.statfs.mockResolvedValue({ blocks: BigInt(Number.MAX_SAFE_INTEGER), bfree: BigInt(10), bsize: BigInt(4096), bavail: BigInt(10) });
    await expect(getLocalStorageCapacity("/data/coursecraft/uploads")).resolves.toBeNull();
  });
});
