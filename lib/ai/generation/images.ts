import { createHash, randomUUID } from "node:crypto";
import { Types } from "mongoose";
import sharp from "sharp";
import { Asset } from "@/models/Asset";
import { DashboardError } from "@/lib/dashboard/rules";
import { defaultCourseGenerationModel } from "../course-generation-schemas";
import { activeStorageConfiguration, deleteStoredMedia, storageProvider } from "@/lib/media/service";
import { providerConnectionError } from "./provider";
import { courseImageStyleInstruction, defaultCourseImageGenerationModel, type CourseImageQuality, type CourseImageStyle } from "../image-style";
import { generationConnectionErrorCode } from "../generation-retry";
import { logGenerationUsage } from "./usage";

export type GeneratedImageOptions = {
  purpose?: "course-cover" | "lesson-cover" | "process-step-guide";
  imageStyle?: CourseImageStyle;
  imageQuality?: CourseImageQuality;
  customImageStyle?: string;
};

async function generateImage(prompt: string, options: GeneratedImageOptions, courseId: string) {
  const cover = options.purpose === "course-cover" || options.purpose === "lesson-cover";
  const lessonCover = options.purpose === "lesson-cover";
  const stepGuide = options.purpose === "process-step-guide";
  const optimizedCourseImage = options.imageQuality === "optimized" && !stepGuide && options.purpose !== "course-cover";
  const fullSizeCourseImage = options.imageQuality === "fullSize" && !stepGuide && options.purpose !== "course-cover";
  const imagePrompt = stepGuide
    ? `Create one clear, accurate instructional demonstration image for a learner. ${prompt}\nCompose a readable 16:9 landscape visual guide. Honor the selected visual type and look. When Auto chooses software screens or Screenshot / UI Mockup is selected, use authentic interface chrome, realistic controls, sharp text and the actual working screen. For web-development screens, default to a recognizable VS Code workspace and a matching browser preview when the step produces a web page, including paired Before & After views when appropriate. Keep the code, CSS styling and rendered app consistent. Use the selected illustration, photographic or clean educational treatment when explicitly requested, without forcing a software screenshot. Prioritize accurate actions, useful detail and legibility. Demonstrate the task visually without printing the instructions, custom prompt or step title in the image. Do not add instruction paragraphs, written directions or captions. Use subtle highlights or arrows only where useful. Include only minimal short labels, necessary interface text or a small worked example. All visible text must be in English only, regardless of the input language or any language requested in the custom prompt. Translate human-readable text into English while preserving code syntax and numeric values. Do not add watermarks or decorative branding.`
    : `Create one polished, original educational image for a course. ${prompt}. ${cover ? lessonCover ? "Compose this as a clean, full-width, extra-wide 3:1 panoramic banner. Keep the main subject inside a central horizontal band so the image can fill a wider 1200 by 312 cover frame without losing important details." : "Compose this as a clean, full-width 16:9 landscape course cover with the main subject clearly readable on desktop and mobile." : "Use a clear educational composition."} ${courseImageStyleInstruction(options.imageStyle ?? "auto", options.customImageStyle)} Do not add words, labels, watermarks, logos, or captions to the image. Keep clear subject separation.`;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey)
    throw new DashboardError(
      "AI generation is not configured. Set OPENAI_API_KEY on the server.",
      503,
    );
  const model = process.env.OPENAI_TEXT_MODEL || defaultCourseGenerationModel;
  const imageModel = process.env.OPENAI_IMAGE_MODEL || defaultCourseImageGenerationModel;
  const usageContext = {
    operationId: randomUUID(), kind: "image" as const,
    stage: options.purpose ?? "lesson-illustration", attempt: 1,
    requestedModel: model, imageModel, courseId, startedAt: Date.now(),
  };
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        store: false,
        input: imagePrompt,
        tools: [
          {
            type: "image_generation",
            model: imageModel,
            size: lessonCover ? "1536x512" : "1280x720",
            ...(cover || stepGuide || optimizedCourseImage || (lessonCover && fullSizeCourseImage)
              ? {
                output_format: "webp",
                output_compression: stepGuide ? 60 : lessonCover ? fullSizeCourseImage ? 100 : optimizedCourseImage ? 60 : 90 : cover ? 70 : 60,
              }
              : {}),
            quality: lessonCover || stepGuide || fullSizeCourseImage || optimizedCourseImage ? "high" : cover ? "medium" : "low",
          },
        ],
        tool_choice: { type: "image_generation" },
      }),
      signal: AbortSignal.timeout(75_000),
    });
  } catch (error) {
    logGenerationUsage(usageContext, { transportErrorCode: generationConnectionErrorCode(error) });
    throw providerConnectionError(error, "image generation service");
  }
  const body: unknown = await response.json().catch(() => null);
  logGenerationUsage(usageContext, { response, body });
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
  const expectsWebp = cover || stepGuide || optimizedCourseImage || (lessonCover && fullSizeCourseImage);
  const isWebp = bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  const signature = expectsWebp ? Buffer.from("RIFF") : Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  if (
    bytes.length < signature.length ||
    bytes.length > 25 * 1024 * 1024 ||
    !bytes.subarray(0, signature.length).equals(signature) ||
    (expectsWebp && !isWebp)
  )
    throw new DashboardError(
      "The generated image did not pass file validation.",
      502,
    );
  if (stepGuide) {
    try {
      // Inspect the provider's WebP without resizing or re-encoding its bytes.
      // API compression is a best-effort size target, not a byte-size limit.
      const metadata = await sharp(bytes, { limitInputPixels: 40_000_000 }).metadata();
      if (metadata.format !== "webp" || metadata.width !== 1280 || metadata.height !== 720)
        throw new DashboardError("The image service returned an invalid step guide image or unexpected dimensions.", 502);
      return { bytes, mimeType: "image/webp", extension: "webp", width: metadata.width, height: metadata.height };
    } catch (error) {
      if (error instanceof DashboardError) throw error;
      throw new DashboardError("The generated image did not pass file validation.", 502);
    }
  }
  if (!cover) return expectsWebp
    ? { bytes, mimeType: "image/webp", extension: "webp", width: 1280, height: 720 }
    : { bytes, mimeType: "image/png", extension: "png", width: 1280, height: 720 };

  try {
    if (lessonCover) {
      const metadata = await sharp(bytes, { limitInputPixels: 40_000_000 }).metadata();
      if (metadata.width !== 1536 || metadata.height !== 512)
        throw new DashboardError("The image service returned lesson cover dimensions other than 1536x512.", 502);
      if (fullSizeCourseImage)
        return { bytes, mimeType: "image/webp", extension: "webp", width: metadata.width, height: metadata.height };
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
  const { bytes, mimeType, extension, width, height } = await generateImage(prompt, options, courseId);
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
        ...(options.imageQuality ? { imageQuality: options.imageQuality } : {}),
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
