import { createHash } from "node:crypto";
import { Types } from "mongoose";
import sharp from "sharp";
import { Asset } from "@/models/Asset";
import { DashboardError } from "@/lib/dashboard/rules";
import { defaultCourseGenerationModel } from "../course-generation-schemas";
import { activeStorageConfiguration, deleteStoredMedia, storageProvider } from "@/lib/media/service";
import { providerConnectionError } from "./provider";
import { courseImageStyleInstruction, defaultCourseImageGenerationModel, type CourseImageStyle } from "../image-style";

export type GeneratedImageOptions = {
  purpose?: "course-cover" | "lesson-cover";
  imageStyle?: CourseImageStyle;
  customImageStyle?: string;
};

async function generateImage(prompt: string, options: GeneratedImageOptions) {
  const cover = options.purpose === "course-cover" || options.purpose === "lesson-cover";
  const lessonCover = options.purpose === "lesson-cover";
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
        input: `Create one polished, original educational image for a course. ${prompt}. ${cover ? lessonCover ? "Compose this as a clean, full-width, extra-wide 3:1 panoramic banner. Keep the main subject inside a central horizontal band so the image can fill a wider 1200 by 312 cover frame without losing important details." : "Compose this as a clean, full-width 16:9 landscape course cover with the main subject clearly readable on desktop and mobile." : "Use a clear educational composition."} ${courseImageStyleInstruction(options.imageStyle ?? "auto", options.customImageStyle)} Do not add words, labels, watermarks, logos, or captions to the image. Keep clear subject separation.`,
        tools: [
          {
            type: "image_generation",
            model: process.env.OPENAI_IMAGE_MODEL || defaultCourseImageGenerationModel,
            size: lessonCover ? "1536x512" : "1280x720",
            ...(cover ? { output_format: "webp", output_compression: lessonCover ? 90 : 70 } : {}),
            quality: lessonCover ? "high" : cover ? "medium" : "low",
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
  const isWebp = bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  const signature = cover ? Buffer.from("RIFF") : Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  if (
    bytes.length < signature.length ||
    bytes.length > 25 * 1024 * 1024 ||
    !bytes.subarray(0, signature.length).equals(signature) ||
    (cover && !isWebp)
  )
    throw new DashboardError(
      "The generated image did not pass file validation.",
      502,
    );
  if (!cover) return { bytes, mimeType: "image/png", extension: "png", width: 1280, height: 720 };

  try {
    if (lessonCover) {
      const metadata = await sharp(bytes, { limitInputPixels: 40_000_000 }).metadata();
      if (metadata.width !== 1536 || metadata.height !== 512)
        throw new DashboardError("The image service returned lesson cover dimensions other than 1536x512.", 502);
      if (bytes.length < 1_000_000)
        return { bytes, mimeType: "image/webp", extension: "webp", width: metadata.width, height: metadata.height };
      for (const quality of [90, 85, 80, 75, 70, 65, 60]) {
        const optimized = await sharp(bytes, { limitInputPixels: 40_000_000 }).webp({ quality }).toBuffer();
        if (optimized.length < 1_000_000)
          return { bytes: optimized, mimeType: "image/webp", extension: "webp", width: metadata.width, height: metadata.height };
      }
      throw new DashboardError("The generated lesson cover could not be compressed below 1 MB without resizing it.", 502);
    }

    const widths = [1200, 1120, 1040, 960, 880, 800];
    for (const width of widths) {
      const height = Math.round(width * 9 / 16);
      for (const quality of [70, 65, 60, 55, 50, 45, 40]) {
        const optimized = await sharp(bytes, { limitInputPixels: 40_000_000 })
          .resize(width, height, { fit: "cover", position: "attention" })
          .webp({ quality })
          .toBuffer();
        if (optimized.length < 1_000_000)
          return { bytes: optimized, mimeType: "image/webp", extension: "webp", width, height };
      }
    }
  } catch (error) {
    if (error instanceof DashboardError) throw error;
    throw new DashboardError("The generated image did not pass file validation.", 502);
  }
  throw new DashboardError("The generated image could not be compressed below 1 MB.", 502);
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
  const { bytes, mimeType, extension, width, height } = await generateImage(prompt, options);
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
      metadata: {
        source: "ai-course-generation",
        prompt,
        imageStyle: options.imageStyle ?? "auto",
        ...(options.imageStyle === "custom" && options.customImageStyle ? { customImageStyle: options.customImageStyle } : {}),
        width,
        height,
        ...(options.purpose ? { purpose: options.purpose } : {}),
      },
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
