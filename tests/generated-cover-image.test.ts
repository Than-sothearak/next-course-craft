import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGeneratedImageAsset } from "@/lib/ai/generation/images";
import { Asset } from "@/models/Asset";
const storage = vi.hoisted(() => ({ upload: vi.fn(async () => undefined) }));
vi.mock("@/lib/media/service", () => ({ activeStorageConfiguration: vi.fn(async () => ({ provider: "local", directory: "/tmp/coursecraft-image-tests" })), storageProvider: () => storage, deleteStoredMedia: vi.fn() }));
const ownerId = "507f1f77bcf86cd799439011", courseId = "507f1f77bcf86cd799439012";
const fetchMock = vi.fn();
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("OPENAI_API_KEY", "test-key"); vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(Asset, "create").mockImplementation((async (value: object) => new Asset(value)) as never);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
function output(bytes: Buffer) { fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ output: [{ type: "image_generation_call", result: bytes.toString("base64") }] }))); }
describe("fast generated course cover assets", () => {
  it("requests low-quality 1280x720 JPEG and stores the corresponding private asset", async () => {
    output(Buffer.from([0xff, 0xd8, 0xff, 0xe0]));
    const image = await createGeneratedImageAsset(ownerId, courseId, "Cover for HTML", { purpose: "course-cover" });
    const request = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(request.tools[0]).toMatchObject({ type: "image_generation", size: "1280x720", quality: "low", output_format: "jpeg", output_compression: 75 });
    expect(storage.upload).toHaveBeenCalledWith(expect.objectContaining({ contentType: "image/jpeg" }));
    expect(Asset.create).toHaveBeenCalledWith(expect.objectContaining({ ownerId, courseId, mimeType: "image/jpeg", originalName: expect.stringMatching(/\.jpg$/), metadata: expect.objectContaining({ purpose: "course-cover", width: 1280, height: 720 }) }));
    expect(image.src).toMatch(/^\/api\/assets\/[a-f\d]{24}\/file$/);
  });
  it("keeps existing lesson illustrations square and PNG", async () => {
    output(Buffer.from("iVBORw0KGgo=", "base64"));
    await createGeneratedImageAsset(ownerId, courseId, "Teaching illustration");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).tools[0]).toMatchObject({ size: "1024x1024", quality: "low" });
    expect(storage.upload).toHaveBeenCalledWith(expect.objectContaining({ contentType: "image/png" }));
  });
  it("rejects a mismatched image format before storing a cover", async () => {
    output(Buffer.from("iVBORw0KGgo=", "base64"));
    await expect(createGeneratedImageAsset(ownerId, courseId, "Cover", { purpose: "course-cover" })).rejects.toThrow("file validation");
    expect(storage.upload).not.toHaveBeenCalled();
  });
});
