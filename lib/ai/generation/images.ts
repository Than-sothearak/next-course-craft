import { createHash } from "node:crypto";
import { Types } from "mongoose";
import { Asset } from "@/models/Asset";
import { DashboardError } from "@/lib/dashboard/rules";
import { defaultCourseGenerationModel } from "../course-generation-schemas";
import { activeStorageConfiguration, deleteStoredMedia, storageProvider } from "@/lib/media/service";
import { providerConnectionError } from "./provider";

export type GeneratedImageOptions = { purpose?: "course-cover" };

async function generateImage(prompt: string, options: GeneratedImageOptions) {
  const cover = options.purpose === "course-cover";
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey)
    throw new DashboardError(
      "AI generation is not configured. Set OPENAI_API_KEY on the server.",
      503,
    );
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_TEXT_MODEL || defaultCourseGenerationModel,
        store: false,
        input: `Create one polished, original educational illustration for a course. ${prompt}. Do not add words, labels, watermarks, logos, or captions to the image. Use a clean, accessible visual style with clear subject separation.`,
        tools: [
          {
            type: "image_generation",
            model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2.5-sunburst",
            size: cover ? "1280x720" : "1024x1024",
            ...(cover ? { output_format: "jpeg", output_compression: 75 } : {}),
            quality: "low",
          },
        ],
        tool_choice: { type: "image_generation" },
      }),
      signal: AbortSignal.timeout(75_000),
    });
  } catch (error) {
    throw providerConnectionError(error, "image generation service");
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 429)
      throw new DashboardError(
        "Image generation is temporarily rate limited. Wait a moment and try again.",
        429,
      );
    if (response.status === 401 || response.status === 403)
      throw new DashboardError(
        "The AI provider rejected the configured API key.",
        503,
      );
    throw new DashboardError(
      "An image could not be generated. Disable generated images or try again.",
      502,
    );
  }
  if (
    !body ||
    typeof body !== "object" ||
    !("output" in body) ||
    !Array.isArray(body.output)
  )
    throw new DashboardError(
      "The image service returned an unreadable response.",
      502,
    );
  const imageItem = body.output.find(
    (item) =>
      item &&
      typeof item === "object" &&
      "type" in item &&
      item.type === "image_generation_call" &&
      "result" in item &&
      typeof item.result === "string",
  );
  if (
    !imageItem ||
    !("result" in imageItem) ||
    typeof imageItem.result !== "string"
  )
    throw new DashboardError(
      "The image service did not return an image. Please try again.",
      502,
    );
  const bytes = Buffer.from(imageItem.result, "base64");
  const signature = cover ? Buffer.from([0xff, 0xd8, 0xff]) : Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  if (
    bytes.length < signature.length ||
    bytes.length > 25 * 1024 * 1024 ||
    !bytes.subarray(0, signature.length).equals(signature)
  )
    throw new DashboardError(
      "The generated image did not pass file validation.",
      502,
    );
  return { bytes, mimeType: cover ? "image/jpeg" : "image/png", extension: cover ? "jpg" : "png" };
}

let activeImageGenerationJobs = 0;

const imageGenerationQueue: (() => void)[] = [];

export async function createGeneratedImageAsset(
  ownerId: string,
  courseId: string,
  prompt: string,
  options: GeneratedImageOptions = {},
) {
  if (activeImageGenerationJobs >= 2)
    await new Promise<void>((resolve) => imageGenerationQueue.push(resolve));
  else activeImageGenerationJobs += 1;
  try {
    return await createGeneratedImageAssetNow(ownerId, courseId, prompt, options);
  } finally {
    const next = imageGenerationQueue.shift();
    if (next) next();
    else activeImageGenerationJobs -= 1;
  }
}

async function createGeneratedImageAssetNow(
  ownerId: string,
  courseId: string,
  prompt: string,
  options: GeneratedImageOptions,
) {
  const { bytes, mimeType, extension } = await generateImage(prompt, options);
  const assetId = new Types.ObjectId();
  const assetIdText = assetId.toString();
  const objectKey = `${ownerId}/${courseId}/${assetIdText}`;
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const { provider, directory } = await activeStorageConfiguration();
  const stored = { objectKey, storageKey: objectKey, storageProvider: provider, storageDirectory: directory, mimeType, size: bytes.length };
  try {
    await storageProvider(provider, directory).upload({ key: objectKey, assetId: assetIdText, body: bytes, contentType: mimeType, size: bytes.length });
    const asset = await Asset.create({
      _id: assetId,
      ownerId,
      courseId,
      objectKey,
      storageProvider: provider,
      storageKey: objectKey,
      ...(directory ? { storageDirectory: directory } : {}),
      originalName: `ai-generated-${assetIdText}.${extension}`,
      mimeType,
      size: bytes.length,
      status: "ready",
      checksum,
      metadata: { source: "ai-course-generation", prompt, ...(options.purpose ? { purpose: options.purpose, width: 1280, height: 720 } : {}) },
    });
    return { src: `/api/assets/${asset._id}/file`, id: assetIdText };
  } catch {
    await deleteStoredMedia(stored).catch(() => undefined);
    throw new DashboardError(
      "The generated image could not be saved to course media storage.",
      502,
    );
  }
}
