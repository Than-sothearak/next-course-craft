import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { activeStorageProvider, deleteStoredMedia, mediaLocation, readStoredMedia, storedMediaBytes, testStorageConnection } from "@/lib/media/service";
import { PlatformSettings } from "@/models/PlatformSettings";
import { LocalStorageProvider } from "@/lib/media/providers/local";
import { S3StorageProvider } from "@/lib/media/providers/s3";
import { hasMediaSignature } from "@/lib/media/validate-file";
import { mediaUploadInputSchema } from "@/lib/media/schemas";

vi.mock("@/lib/db/mongodb", () => ({ connectToDatabase: vi.fn() }));
const asset = { _id: "id", objectKey: "legacy/key", mimeType: "image/png", size: 4 };
beforeEach(() => { vi.spyOn(PlatformSettings, "findById").mockReturnValue({ lean: async () => null } as never); });
afterEach(() => vi.restoreAllMocks());

describe("per-asset provider routing", () => {
  it("defaults new uploads to S3 until configured, and observes switches without a process restart", async () => {
    expect(await activeStorageProvider()).toBe("s3");
    vi.mocked(PlatformSettings.findById).mockReturnValue({ lean: async () => ({ mediaStorageProvider: "local" }) } as never);
    expect(await activeStorageProvider()).toBe("local");
    vi.mocked(PlatformSettings.findById).mockReturnValue({ lean: async () => ({ mediaStorageProvider: "s3" }) } as never);
    expect(await activeStorageProvider()).toBe("s3");
  });
  it("reads and deletes legacy S3 using the old key while local is active", async () => {
    vi.mocked(PlatformSettings.findById).mockReturnValue({ lean: async () => ({ mediaStorageProvider: "local" }) } as never);
    const read = vi.spyOn(S3StorageProvider.prototype, "read").mockResolvedValue(new Response("data"));
    const remove = vi.spyOn(S3StorageProvider.prototype, "delete").mockResolvedValue();
    await readStoredMedia(asset);
    await deleteStoredMedia(asset);
    expect(read).toHaveBeenCalledWith({ key: "legacy/key", contentType: "image/png", size: 4, assetId: "id" }, undefined);
    expect(remove).toHaveBeenCalledWith("legacy/key");
  });
  it("uses stored local keys even when S3 is selected", async () => {
    const local = { ...asset, storageProvider: "local", storageKey: "saved/key" };
    const read = vi.spyOn(LocalStorageProvider.prototype, "read").mockResolvedValue(new Response("data"));
    const remove = vi.spyOn(LocalStorageProvider.prototype, "delete").mockResolvedValue();
    await readStoredMedia(local);
    await deleteStoredMedia(local);
    expect(read).toHaveBeenCalledWith(expect.objectContaining({ key: "saved/key" }), undefined);
    expect(remove).toHaveBeenCalledWith("saved/key");
  });
  it("fails closed for an unknown saved provider", () => {
    expect(() => mediaLocation({ ...asset, storageProvider: "unknown" })).toThrow("Unknown");
  });
  it("bounds media reads and detects truncated storage responses", async () => {
    const read = vi.spyOn(S3StorageProvider.prototype, "read");
    read.mockResolvedValueOnce(new Response("data"));
    expect((await storedMediaBytes(asset)).toString()).toBe("data");
    read.mockResolvedValueOnce(new Response("oversized"));
    await expect(storedMediaBytes(asset)).rejects.toMatchObject({ status: 409 });
    read.mockResolvedValueOnce(new Response("bad"));
    await expect(storedMediaBytes(asset)).rejects.toMatchObject({ status: 409 });
  });
});

describe("connection probes", () => {
  it.each(["local", "s3"] as const)("tests upload, metadata, bytes and cleanup on %s", async (name) => {
    const prototype = name === "local" ? LocalStorageProvider.prototype : S3StorageProvider.prototype;
    let bytes: Buffer;
    const upload = vi.spyOn(prototype, "upload").mockImplementation(async (input) => { bytes = input.body as Buffer; });
    vi.spyOn(prototype, "metadata").mockImplementation(async () => ({ size: bytes.length }));
    vi.spyOn(prototype, "read").mockImplementation(async () => new Response(new Uint8Array(bytes)));
    const remove = vi.spyOn(prototype, "delete").mockResolvedValue();
    expect(await testStorageConnection(name)).toMatchObject({ provider: name, connected: true });
    expect(remove).toHaveBeenCalledWith(upload.mock.calls[0][0].key);
  });
  it("attempts cleanup after an ambiguous write failure without returning credentials", async () => {
    vi.spyOn(S3StorageProvider.prototype, "upload").mockRejectedValue(new Error("secret-credential"));
    const remove = vi.spyOn(S3StorageProvider.prototype, "delete").mockResolvedValue();
    await expect(testStorageConnection("s3")).rejects.toThrow("S3 connection test failed");
    expect(remove).toHaveBeenCalledOnce();
  });
  it("fails the connection test if deletion is not permitted", async () => {
    let bytes: Buffer;
    vi.spyOn(S3StorageProvider.prototype, "upload").mockImplementation(async (input) => { bytes = input.body as Buffer; });
    vi.spyOn(S3StorageProvider.prototype, "metadata").mockImplementation(async () => ({ size: bytes.length }));
    vi.spyOn(S3StorageProvider.prototype, "read").mockImplementation(async () => new Response(new Uint8Array(bytes)));
    vi.spyOn(S3StorageProvider.prototype, "delete").mockRejectedValue(new Error("AccessDenied"));
    await expect(testStorageConnection("s3")).rejects.toMatchObject({ status: 503 });
  });
});

describe("shared media validation", () => {
  it.each(["audio/mpeg", "audio/mp4", "audio/ogg", "audio/wav", "audio/webm", "application/pdf", "text/plain"])("supports bounded %s uploads", (contentType) => {
    expect(mediaUploadInputSchema.safeParse({ fileName: "lesson", contentType, size: 1024 }).success).toBe(true);
    expect(mediaUploadInputSchema.safeParse({ fileName: "lesson", contentType, size: 250 * 1024 * 1024 }).success).toBe(false);
  });
  it("rejects executable formats and disguised binary content", () => {
    for (const contentType of ["text/html", "application/javascript", "image/svg+xml", "application/x-executable"]) {
      expect(mediaUploadInputSchema.safeParse({ fileName: "payload", contentType, size: 1024 }).success).toBe(false);
    }
    expect(hasMediaSignature("image/png", Buffer.from("MZ executable"))).toBe(false);
    expect(hasMediaSignature("text/plain", Buffer.from("#!/bin/sh"))).toBe(false);
    expect(hasMediaSignature("application/pdf", Buffer.from("%PDF-1.7"))).toBe(true);
    expect(hasMediaSignature("audio/wav", Buffer.from("RIFF0000WAVE"))).toBe(true);
  });
});
