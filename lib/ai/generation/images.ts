import { createHash } from "node:crypto";
import { Types } from "mongoose";
import { Asset } from "@/models/Asset";
import { DashboardError } from "@/lib/dashboard/rules";
import { defaultCourseGenerationModel } from "../course-generation-schemas";
import { activeStorageConfiguration, deleteStoredMedia, storageProvider } from "@/lib/media/service";
import { providerConnectionError } from "./provider";

async function generateImage(prompt: string) {
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
            size: "1024x1024",
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
  const pngSignature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  if (
    bytes.length < pngSignature.length ||
    bytes.length > 25 * 1024 * 1024 ||
    !bytes.subarray(0, 8).equals(pngSignature)
  )
    throw new DashboardError(
      "The generated image did not pass file validation.",
      502,
    );
  return bytes;
}

let activeImageGenerationJobs = 0;

const imageGenerationQueue: (() => void)[] = [];

export async function createGeneratedImageAsset(
  ownerId: string,
  courseId: string,
  prompt: string,
) {
  if (activeImageGenerationJobs >= 2)
    await new Promise<void>((resolve) => imageGenerationQueue.push(resolve));
  else activeImageGenerationJobs += 1;
  try {
    return await createGeneratedImageAssetNow(ownerId, courseId, prompt);
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
) {
  const bytes = await generateImage(prompt);
  const assetId = new Types.ObjectId();
  const assetIdText = assetId.toString();
  const objectKey = `${ownerId}/${courseId}/${assetIdText}`;
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const { provider, directory } = await activeStorageConfiguration();
  const stored = { objectKey, storageKey: objectKey, storageProvider: provider, storageDirectory: directory, mimeType: "image/png", size: bytes.length };
  try {
    await storageProvider(provider, directory).upload({ key: objectKey, assetId: assetIdText, body: bytes, contentType: "image/png", size: bytes.length });
    const asset = await Asset.create({
      _id: assetId,
      ownerId,
      courseId,
      objectKey,
      storageProvider: provider,
      storageKey: objectKey,
      ...(directory ? { storageDirectory: directory } : {}),
      originalName: `ai-generated-${assetIdText}.png`,
      mimeType: "image/png",
      size: bytes.length,
      status: "ready",
      checksum,
      metadata: { source: "ai-course-generation", prompt },
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
