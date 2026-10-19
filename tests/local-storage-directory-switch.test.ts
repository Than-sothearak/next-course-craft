import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlatformSettings } from "@/models/PlatformSettings";
import { LocalStorageProvider } from "@/lib/media/providers/local";
import { activeStorageConfiguration, deleteStoredMedia, storedMediaBytes } from "@/lib/media/service";

vi.mock("@/lib/db/mongodb", () => ({ connectToDatabase: vi.fn() }));
let root: string;
let original: string;
let selected: string;
const asset = { _id: "id", storageProvider: "local", objectKey: "owner/course/file", storageKey: "owner/course/file", mimeType: "image/png", size: 4 };
beforeEach(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), "coursecraft-switch-")));
  original = join(root, "original"); selected = join(root, "selected");
  vi.stubEnv("MEDIA_LOCAL_DIRECTORY", original);
  vi.spyOn(PlatformSettings, "findById").mockReturnValue({ lean: async () => ({ mediaStorageProvider: "local", mediaLocalDirectory: selected }) } as never);
  const file = { key: asset.objectKey, contentType: asset.mimeType, assetId: "id", size: 4 };
  await new LocalStorageProvider(original).upload({ ...file, body: Buffer.from("old!") });
  await new LocalStorageProvider(selected).upload({ ...file, body: Buffer.from("new!") });
});
afterEach(async () => { vi.restoreAllMocks(); vi.unstubAllEnvs(); await rm(root, { recursive: true, force: true }); });

describe("local directory switching compatibility", () => {
  it("uses the selected directory for new uploads while legacy local records stay at the original environment path", async () => {
    expect(await activeStorageConfiguration()).toEqual({ provider: "local", directory: selected });
    expect((await storedMediaBytes(asset)).toString()).toBe("old!");
    expect((await storedMediaBytes({ ...asset, storageDirectory: selected })).toString()).toBe("new!");
  });
  it("resolves saved directories even after environment defaults and browse boundaries change", async () => {
    vi.stubEnv("MEDIA_LOCAL_DIRECTORY", "/unused/default");
    vi.stubEnv("MEDIA_LOCAL_ROOT", "/unused/new-browse-root");
    expect((await storedMediaBytes({ ...asset, storageDirectory: original })).toString()).toBe("old!");
  });
  it("deletes from the asset's original directory without affecting the same key in the newly selected folder", async () => {
    await deleteStoredMedia({ ...asset, storageDirectory: original });
    await expect(new LocalStorageProvider(original).metadata(asset.objectKey)).rejects.toMatchObject({ status: 404 });
    expect((await storedMediaBytes({ ...asset, storageDirectory: selected })).toString()).toBe("new!");
  });
});
