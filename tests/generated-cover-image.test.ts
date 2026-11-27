import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { createGeneratedImageAsset } from "@/lib/ai/generation/images";
import { toLessonCoverBlock } from "@/lib/ai/generation/block-content";
import { Asset } from "@/models/Asset";
import { processStepImagePrompt } from "@/lib/ai/process-step-image";
const storage = vi.hoisted(() => ({ upload: vi.fn(async () => undefined) }));
vi.mock("@/lib/media/service", () => ({ activeStorageConfiguration: vi.fn(async () => ({ provider: "local", directory: "/tmp/coursecraft-image-tests" })), storageProvider: () => storage, deleteStoredMedia: vi.fn() }));
const ownerId = "507f1f77bcf86cd799439011", courseId = "507f1f77bcf86cd799439012";
const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubEnv("OPENAI_USAGE_LOG_FORMAT", "json");
  vi.clearAllMocks(); vi.stubEnv("OPENAI_API_KEY", "test-key"); vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(Asset, "create").mockImplementation((async (value: object) => new Asset(value)) as never);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
function output(bytes: Buffer) { fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ output: [{ type: "image_generation_call", result: bytes.toString("base64") }] }))); }
const webp = (width = 1280, height = 720) => sharp({ create: { width, height, channels: 3, background: "#345678" } }).webp().toBuffer();
describe("fast generated course cover assets", () => {
  it("requests medium-quality WebP and stores a 1200x675 cover below 1 MB", async () => {
    output(await webp());
    const image = await createGeneratedImageAsset(ownerId, courseId, "Cover for HTML", { purpose: "course-cover" });
    const request = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(request.tools[0]).toMatchObject({ type: "image_generation", size: "1280x720", quality: "medium", output_format: "webp", output_compression: 70 });
    expect(storage.upload).toHaveBeenCalledWith(expect.objectContaining({ contentType: "image/webp", size: expect.any(Number) }));
    const asset = vi.mocked(Asset.create).mock.calls[0][0] as Record<string, unknown>;
    expect(asset).toMatchObject({ ownerId, courseId, mimeType: "image/webp", originalName: expect.stringMatching(/\.webp$/), metadata: expect.objectContaining({ purpose: "course-cover", width: 1200, height: 675 }) });
    expect(asset.size).toBeLessThan(1_000_000);
    expect(image.src).toMatch(/^\/api\/assets\/[a-f\d]{24}\/file$/);
  });
  it("keeps AI-generated lesson cover pixels and uses the full-width cover block settings", async () => {
    const generatedBytes = await webp(1536, 512);
    output(generatedBytes);
    const block = await toLessonCoverBlock(ownerId, courseId, "HTML basics", "Create a page", "Build a semantic HTML page", vi.fn(), { imageStyle: "flatIllustration" });
    expect(block).toMatchObject({ type: "image", width: "full", widthCustom: false, blockPadding: 0, data: { layout: "cover", imageFit: "cover", imageAspectRatio: "50/13", coverOverlayOpacity: 0, alt: "Create a page lesson cover" } });
    const request = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(request.input).toContain("full-width, extra-wide 3:1 panoramic banner");
    expect(request.tools[0]).toMatchObject({ size: "1536x512", quality: "high", output_format: "webp", output_compression: 90 });
    expect(Asset.create).toHaveBeenCalledWith(expect.objectContaining({ size: generatedBytes.length, metadata: expect.objectContaining({ purpose: "lesson-cover", width: 1536, height: 512 }) }));
  });
  it("generates lesson illustrations in a 16:9 PNG format", async () => {
    output(Buffer.from("iVBORw0KGgo=", "base64"));
    await createGeneratedImageAsset(ownerId, courseId, "Teaching illustration");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).tools[0]).toMatchObject({ size: "1280x720", quality: "low" });
    expect(storage.upload).toHaveBeenCalledWith(expect.objectContaining({ contentType: "image/png" }));
    expect(Asset.create).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ width: 1280, height: 720 }) }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).input).toContain("Do not add words, labels");
  });
  it.each([
    { title: "HTML heading", instructions: 'Type <h1>Hello</h1> in the editor and preview the page.', customPrompt: "" },
    { title: "Prepare", instructions: "Wash the vegetables.", customPrompt: "Show hands rinsing carrots under running water." },
    { title: "Enregistrer", instructions: "Cliquez sur Enregistrer pour sauvegarder le document.", customPrompt: "" },
    { title: "Ouvrir", instructions: "Open the menu.", customPrompt: "Montrez le menu avec des étiquettes en français." },
  ])("requests a detailed practical guide with readable annotations for $title", async (input) => {
    output(await webp());
    await createGeneratedImageAsset(ownerId, courseId, processStepImagePrompt(input), { purpose: "process-step-guide" });
    const request = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(request.input).toContain(input.customPrompt || input.instructions);
    expect(request.input).toContain("what its result looks like");
    expect(request.input).toContain("annotated interface example");
    expect(request.input).toContain("without printing the instructions, custom prompt or step title");
    expect(request.input).toContain("Do not add instruction paragraphs, written directions or captions");
    expect(request.input).toContain("All visible text must be in English only");
    expect(request.input).toContain("regardless of the input language or any language requested in the custom prompt");
    expect(request.input).toContain("preserving code syntax and numeric values");
    expect(request.input).not.toContain("Use the language of the supplied image instructions");
    expect(request.input).not.toContain("Do not add words, labels");
    expect(request.input).not.toContain("Compose this as a clean, full-width");
    if (input.customPrompt) expect(request.input).not.toContain(input.instructions);
    expect(request.tools[0]).toMatchObject({ size: "1280x720", quality: "high", output_format: "webp", output_compression: 60 });
    expect(Asset.create).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ purpose: "process-step-guide" }) }));
  });
  it("adds the selected visual treatment to image generation prompts", async () => {
    output(Buffer.from("iVBORw0KGgo=", "base64"));
    await createGeneratedImageAsset(ownerId, courseId, "A student learning HTML", { imageStyle: "3dCartoon" });
    const request = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(request.input).toContain("friendly 3D cartoon style");
    expect(Asset.create).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ imageStyle: "3dCartoon" }) }));
  });
  it.each([
    { title: "Style a heading", instructions: "In styles.css, set h1 color to blue and preview the HTML page.", customPrompt: "" },
    { title: "Page layout", instructions: "Create a web page.", customPrompt: "Use WebStorm with the CSS editor and browser result." },
    { title: "Start the server", instructions: "Run npm run dev in the VS Code terminal.", customPrompt: "" },
  ])("requests realistic app screens and consistent code/output for $title", async (input) => {
    output(await webp());
    await createGeneratedImageAsset(ownerId, courseId, processStepImagePrompt(input), { purpose: "process-step-guide" });
    const request = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(request.input).toContain(input.customPrompt || input.instructions);
    expect(request.input).toContain("use Visual Studio Code (VS Code) unless another editor is explicitly requested");
    expect(request.input).toContain("Explorer file tree, correctly named file tabs, line numbers");
    expect(request.input).toContain("browser result must agree with the visible code");
    expect(request.input).toContain("Include the relevant CSS and its visible effect");
    expect(request.input).toContain("instead of forcing a browser preview");
    expect(request.input).toContain("Keep the code, CSS styling and rendered app consistent");
    expect(request.input).toContain("Avoid invented generic app interfaces, cartoon computers");
    expect(request.input).toContain("All visible text must be in English only");
    expect(request.input).toContain("without printing the instructions, custom prompt or step title");
  });
  it("stores the compressed step WebP exactly as returned by the API", async () => {
    const providerBytes = await webp();
    output(providerBytes);
    await createGeneratedImageAsset(ownerId, courseId, "Show VS Code and its browser result", { purpose: "process-step-guide" });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(storage.upload).toHaveBeenCalledWith(expect.objectContaining({ body: providerBytes, contentType: "image/webp", size: providerBytes.length }));
    expect(Asset.create).toHaveBeenCalledWith(expect.objectContaining({
      mimeType: "image/webp", originalName: expect.stringMatching(/\.webp$/), size: providerBytes.length,
      metadata: expect.objectContaining({ purpose: "process-step-guide", width: 1280, height: 720 }),
    }));
  });
  it.each(["png", "invalid-webp", "wrong-dimensions"])("rejects a step guide with %s output before storage", async (kind) => {
    const bytes = kind === "png" ? Buffer.from("iVBORw0KGgo=", "base64")
      : kind === "invalid-webp" ? Buffer.from("RIFF0000WEBPinvalid") : await webp(960, 540);
    output(bytes);
    await expect(createGeneratedImageAsset(ownerId, courseId, "Step guide", { purpose: "process-step-guide" })).rejects.toMatchObject({ status: 502 });
    expect(storage.upload).not.toHaveBeenCalled();
    expect(Asset.create).not.toHaveBeenCalled();
  });
  it("uses a bounded custom visual direction in image prompts", async () => {
    output(Buffer.from("iVBORw0KGgo=", "base64"));
    await createGeneratedImageAsset(ownerId, courseId, "A student learning HTML", { imageStyle: "custom", customImageStyle: "Warm paper-cut collage" });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).input).toContain("Warm paper-cut collage");
  });
  it("rejects a mismatched image format before storing a cover", async () => {
    output(Buffer.from("iVBORw0KGgo=", "base64"));
    await expect(createGeneratedImageAsset(ownerId, courseId, "Cover", { purpose: "course-cover" })).rejects.toThrow("file validation");
    expect(storage.upload).not.toHaveBeenCalled();
  });
  it("records mainline input usage even when the generated image fails file validation", async () => {
    vi.stubEnv("OPENAI_TEXT_MODEL", "gpt-6-luna");
    vi.stubEnv("OPENAI_IMAGE_MODEL", "gpt-image-2.6-flare");
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      id: "resp_image", model: "gpt-6-luna", status: "completed", service_tier: "default",
      usage: { input_tokens: 100, input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 }, output_tokens: 10 },
      output: [{ type: "image_generation_call", result: "PRIVATE BASE64" }],
    })));
    await expect(createGeneratedImageAsset(ownerId, courseId, "PRIVATE PROMPT", { purpose: "course-cover" })).rejects.toThrow("file validation");
    expect(console.info).toHaveBeenCalledTimes(1);
    const event = JSON.parse(vi.mocked(console.info).mock.calls[0][0]);
    expect(event).toMatchObject({ kind: "image", stage: "course-cover", responseId: "resp_image", usage: { inputTokens: 100 }, inputCostEstimate: { usd: 0.00001, scope: "mainline_model_input_only" }, imageCalls: [{ model: "gpt-image-2.6-flare", usage: { inputTokens: null, cachedInputTokens: null } }] });
    expect(JSON.stringify(event)).not.toContain("PRIVATE");
  });
  it("records image transport errors without claiming zero usage or submitting a retry", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    fetchMock.mockRejectedValueOnce(Object.assign(new Error("PRIVATE FAILURE"), { code: "ETIMEDOUT" }));
    await expect(createGeneratedImageAsset(ownerId, courseId, "PRIVATE PROMPT")).rejects.toMatchObject({ status: 504 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const event = JSON.parse(vi.mocked(console.info).mock.calls[0][0]);
    expect(event).toMatchObject({ kind: "image", outcome: "transport_error", transportErrorCode: "ETIMEDOUT", usage: { inputTokens: null }, inputCostEstimate: { usd: null } });
  });
});
