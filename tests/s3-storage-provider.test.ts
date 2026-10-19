import { afterEach, describe, expect, it, vi } from "vitest";
import { S3StorageProvider } from "@/lib/media/providers/s3";
import * as storage from "@/lib/media/storage";

const file = { key: "owner/course/asset", contentType: "audio/mpeg", assetId: "asset", size: 4 };
const provider = new S3StorageProvider();
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe("S3 adapter reuses existing private storage operations", () => {
  it("uploads with the existing AWS implementation and preserves metadata", async () => {
    const put = vi.spyOn(storage, "putMediaObject").mockResolvedValue();
    const body = Buffer.from("data");
    await provider.upload({ ...file, body });
    expect(put).toHaveBeenCalledWith({ objectKey: file.key, assetId: "asset", contentType: "audio/mpeg", body });
    await expect(provider.upload({ ...file, body: Buffer.from("short") })).rejects.toMatchObject({ status: 400 });
    const head = vi.spyOn(storage, "inspectMediaObject").mockResolvedValue({ ContentLength: 4, ContentType: "audio/mpeg", Metadata: { "asset-id": "asset" }, $metadata: {} });
    expect(await provider.metadata(file.key)).toEqual({ size: 4, contentType: "audio/mpeg", assetId: "asset" });
    expect(head).toHaveBeenCalledWith(file.key);
  });
  it("reads server-side signed URLs with range, no-store and cancellation, and preserves 416", async () => {
    const signed = vi.spyOn(storage, "createMediaReadUrl").mockResolvedValue("https://s3.example/private-signed-url");
    const response = new Response(null, { status: 416, headers: { "Content-Range": "bytes */4" } });
    const fetchMock = vi.fn(async () => response);
    vi.stubGlobal("fetch", fetchMock);
    const signal = new AbortController().signal;
    expect(await provider.read(file, { range: "bytes=8-", signal })).toBe(response);
    expect(signed).toHaveBeenCalledWith({ objectKey: file.key, contentType: "audio/mpeg" });
    expect(fetchMock).toHaveBeenCalledWith("https://s3.example/private-signed-url", { cache: "no-store", headers: { Range: "bytes=8-" }, signal });
  });
  it("deletes with the original key and propagates failures", async () => {
    const remove = vi.spyOn(storage, "deleteMediaObject").mockResolvedValue();
    await provider.delete(file.key);
    expect(remove).toHaveBeenCalledWith(file.key);
    remove.mockRejectedValue(new Error("S3 unavailable"));
    await expect(provider.delete(file.key)).rejects.toThrow("S3 unavailable");
  });
});
