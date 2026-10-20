import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Asset } from "@/models/Asset";
import { S3StorageProvider } from "@/lib/media/providers/s3";
import { LocalStorageProvider } from "@/lib/media/providers/local";
import { activeStorageConfiguration } from "@/lib/media/service";
import { beginMediaUpload, completeMediaUpload } from "@/lib/media/services/uploads";
import { PUT } from "@/app/api/courses/[courseId]/assets/[assetId]/upload/route";
import { resolveCourseAccess } from "@/lib/workspaces/access";
import { createMediaUploadPost } from "@/lib/media/storage";

vi.mock("@/lib/db/mongodb", () => ({ connectToDatabase: vi.fn() }));
vi.mock("@/lib/auth/authorization", () => ({ requireActiveUser: vi.fn(async () => ({ id: "507f1f77bcf86cd799439011" })) }));
vi.mock("@/lib/workspaces/access", () => ({ resolveCourseAccess: vi.fn(async () => ({ ownerId: "507f1f77bcf86cd799439011" })) }));
vi.mock("@/lib/media/service", async (original) => ({ ...await original<typeof import("@/lib/media/service")>(), activeStorageConfiguration: vi.fn(async () => ({ provider: "local" })) }));
vi.mock("@/lib/media/storage", async (original) => ({ ...await original<typeof import("@/lib/media/storage")>(), createMediaUploadPost: vi.fn(async () => ({ url: "https://s3.example/upload", fields: { policy: "bound-policy" } })) }));

const ownerId = "507f1f77bcf86cd799439011";
const courseId = "507f1f77bcf86cd799439012";
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const input = { fileName: "../../lesson.png", contentType: "image/png" as const, size: png.length };
let directory: string;
let pending: Record<string, unknown>;
const save = vi.fn();
beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(activeStorageConfiguration).mockResolvedValue({ provider: "local" });
  directory = await realpath(await mkdtemp(join(tmpdir(), "coursecraft-upload-")));
  vi.stubEnv("MEDIA_LOCAL_DIRECTORY", directory);
  vi.mocked(activeStorageConfiguration).mockResolvedValue({ provider: "local", directory });
  vi.spyOn(Asset, "create").mockImplementation((async (value: Record<string, unknown>) => { pending = { ...value, save }; return pending; }) as never);
  vi.spyOn(Asset, "findOne").mockImplementation(((query: Record<string, unknown>) => Promise.resolve(
    pending && String(query._id) === String(pending._id) && query.ownerId === pending.ownerId && query.courseId === pending.courseId && query.status === pending.status && (!query.storageProvider || query.storageProvider === pending.storageProvider) ? pending : null,
  )) as never);
  vi.spyOn(Asset, "deleteOne").mockResolvedValue({ acknowledged: true, deletedCount: 1 });
});
afterEach(async () => { vi.restoreAllMocks(); vi.unstubAllEnvs(); await rm(directory, { recursive: true, force: true }); });

function context(id = String(pending._id)) { return { params: Promise.resolve({ courseId, assetId: id }) }; }
function request(body = png, headers: Record<string, string> = {}) {
  return new NextRequest("https://courses.example/api/upload", { method: "PUT", headers: { "Content-Type": "image/png", ...headers }, body: new Uint8Array(body) });
}

describe("existing upload lifecycle with provider switching", () => {
  it("uses unique server keys, streams local bytes, and completes with the original provider after switching", async () => {
    const upload = await beginMediaUpload(ownerId, courseId, input);
    expect(upload).toMatchObject({ method: "PUT", uploadUrl: `/api/courses/${courseId}/assets/${upload.assetId}/upload` });
    expect(pending.objectKey).toBe(`${ownerId}/${courseId}/${upload.assetId}`);
    expect(pending.storageProvider).toBe("local");
    expect(pending.storageDirectory).toBe(directory);
    vi.stubEnv("MEDIA_LOCAL_DIRECTORY", join(directory, "different-default"));
    vi.mocked(activeStorageConfiguration).mockResolvedValue({ provider: "s3" });
    expect((await PUT(request(), context())).status).toBe(204);
    expect(await completeMediaUpload(ownerId, courseId, upload.assetId)).toMatchObject({ id: upload.assetId, fileUrl: `/api/assets/${upload.assetId}/file` });
    expect(await new LocalStorageProvider(directory).metadata(String(pending.storageKey))).toEqual({ size: 8 });
    expect(save).toHaveBeenCalledOnce();
    expect(pending.status).toBe("ready");
    expect(resolveCourseAccess).toHaveBeenCalledWith(ownerId, courseId, "edit");
  });
  it("preserves direct S3 policies and verifies S3 metadata after switching to local", async () => {
    vi.mocked(activeStorageConfiguration).mockResolvedValue({ provider: "s3" });
    const upload = await beginMediaUpload(ownerId, courseId, input);
    expect(upload).toMatchObject({ method: "POST", uploadUrl: "https://s3.example/upload", fields: { policy: "bound-policy" } });
    expect(createMediaUploadPost).toHaveBeenCalledWith({ objectKey: pending.objectKey, assetId: upload.assetId, contentType: "image/png", size: 8 });
    vi.mocked(activeStorageConfiguration).mockResolvedValue({ provider: "local" });
    vi.spyOn(S3StorageProvider.prototype, "metadata").mockResolvedValue({ size: 8, contentType: "image/png", assetId: upload.assetId });
    vi.spyOn(S3StorageProvider.prototype, "read").mockResolvedValue(new Response(new Uint8Array(png)));
    await completeMediaUpload(ownerId, courseId, upload.assetId);
    expect(save).toHaveBeenCalledOnce();
    expect((await PUT(request(), context())).status).toBe(404);
  });
  it("stores and completes arbitrary attachment bytes as a downloadable opaque file", async () => {
    const bytes = Buffer.from("PowerPoint or other attachment bytes");
    const attachment = {
      fileName: "lesson-material.pptx",
      contentType: "application/octet-stream" as const,
      purpose: "attachment" as const,
      size: bytes.length,
    };
    const upload = await beginMediaUpload(ownerId, courseId, attachment);
    expect(upload.contentType).toBe("application/octet-stream");
    expect(pending.mimeType).toBe("application/octet-stream");
    expect((await PUT(request(bytes, { "Content-Type": "application/octet-stream" }), context(upload.assetId))).status).toBe(204);
    await expect(completeMediaUpload(ownerId, courseId, upload.assetId)).resolves.toMatchObject({ originalName: "lesson-material.pptx" });
    expect(await new LocalStorageProvider(directory).metadata(String(pending.storageKey))).toEqual({ size: bytes.length });
    expect(save).toHaveBeenCalledOnce();
  });
  it("rejects foreign records and cross-origin requests before writing", async () => {
    await beginMediaUpload(ownerId, courseId, input);
    const upload = vi.spyOn(LocalStorageProvider.prototype, "upload");
    expect((await PUT(request(), context("507f1f77bcf86cd799439099"))).status).toBe(404);
    expect((await PUT(request(png, { origin: "https://attacker.example" }), context())).status).toBe(403);
    pending.ownerId = "another-owner";
    expect((await PUT(request(), context())).status).toBe(404);
    expect(upload).not.toHaveBeenCalled();
  });
  it("rejects mismatched MIME types and oversized bodies without publishing a file", async () => {
    await beginMediaUpload(ownerId, courseId, input);
    expect((await PUT(request(png, { "Content-Type": "text/html" }), context())).status).toBe(400);
    expect((await PUT(request(Buffer.alloc(16)), context())).status).toBe(413);
    await expect(new LocalStorageProvider().metadata(String(pending.storageKey))).rejects.toMatchObject({ status: 404 });
    expect(save).not.toHaveBeenCalled();
  });
  it("deletes disguised executables before they become visible to the media library", async () => {
    const upload = await beginMediaUpload(ownerId, courseId, input);
    expect((await PUT(request(Buffer.from("MZ123456")), context())).status).toBe(204);
    await expect(completeMediaUpload(ownerId, courseId, upload.assetId)).rejects.toThrow("contents do not match");
    expect(save).not.toHaveBeenCalled();
    expect(Asset.deleteOne).toHaveBeenCalledWith({ _id: pending._id, ownerId, courseId, status: "pending" });
    await expect(new LocalStorageProvider().metadata(String(pending.storageKey))).rejects.toMatchObject({ status: 404 });
  });
  it("retains tracking metadata if a rejected upload cannot be cleaned from storage", async () => {
    const upload = await beginMediaUpload(ownerId, courseId, input);
    await PUT(request(Buffer.from("MZ123456")), context());
    vi.spyOn(LocalStorageProvider.prototype, "delete").mockRejectedValue(new Error("Disk unavailable"));
    await expect(completeMediaUpload(ownerId, courseId, upload.assetId)).rejects.toThrow("Disk unavailable");
    expect(Asset.deleteOne).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });
});
