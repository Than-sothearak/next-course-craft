import { createHash, randomUUID } from "node:crypto";
import { Types } from "mongoose";
import sharp from "sharp";
import { Asset } from "@/models/Asset";
import { DashboardError } from "@/lib/dashboard/rules";
import { defaultCourseGenerationModel } from "../course-generation-schemas";
import { activeStorageConfiguration, deleteStoredMedia, storageProvider } from "@/lib/media/service";
import { providerConnectionError } from "./provider";
import { courseImageStyleInstruction, defaultCourseImageGenerationModel, generatedCourseImageMaxBytes, generatedCourseImageOutputCompression, generatedImageDimensions, type CourseImageModel, type CourseImageQuality, type CourseImageStyle, type GeneratedImagePurpose } from "../image-style";
import { generationConnectionErrorCode } from "../generation-retry";
import { logGenerationUsage } from "./usage";

export type GeneratedImageOptions = {
  purpose?: GeneratedImagePurpose;
  imageStyle?: CourseImageStyle;
  imageQuality?: CourseImageQuality;
  imageModel?: CourseImageModel;
  customImageStyle?: string;
};

async function generateImage(prompt: string, options: GeneratedImageOptions, courseId: string) {
  const cover = options.purpose === "course-cover" || options.purpose === "lesson-cover";
  const lessonCover = options.purpose === "lesson-cover";
  const stepGuide = options.purpose === "process-step-guide";
  const imageModel = options.imageModel ?? (process.env.OPENAI_IMAGE_MODEL || defaultCourseImageGenerationModel);
  const imageQuality = options.imageQuality ?? "medium";
  const { width, height } = generatedImageDimensions(imageQuality, imageModel, options.purpose);
  const panoramicLessonCover = lessonCover && width === height * 3;
  const imagePrompt = stepGuide
    ? `Create one clear, accurate instructional demonstration image for a learner. ${prompt}\nCompose a readable landscape visual guide in the requested ${width} by ${height} dimensions. Honor the selected visual type and look. When Auto chooses software screens or Screenshot / UI Mockup is selected, use authentic interface chrome, realistic controls, sharp text and the actual working screen. For web-development screens, default to a recognizable VS Code workspace and a matching browser preview when the step produces a web page, including paired Before & After views when appropriate. Keep the code, CSS styling and rendered app consistent. Use the selected illustration, photographic or clean educational treatment when explicitly requested, without forcing a software screenshot. Prioritize accurate actions, useful detail and legibility. Demonstrate the task visually without printing the instructions, custom prompt or step title in the image. Do not add instruction paragraphs, written directions or captions. Use subtle highlights or arrows only where useful. Include only minimal short labels, necessary interface text or a small worked example. All visible text must be in English only, regardless of the input language or any language requested in the custom prompt. Translate human-readable text into English while preserving code syntax and numeric values. Do not add watermarks or decorative branding.`
    : `Create one polished, original educational image for a course. ${prompt}. ${cover ? lessonCover ? panoramicLessonCover ? "Compose this as a clean, full-width 3:1 panoramic lesson banner. Keep the main subject inside a central horizontal band so important details are retained in a 1440 by 480 cover frame." : `Compose a clean landscape lesson cover in the requested ${width} by ${height} dimensions. Keep the main subject inside a central horizontal band so important details stay visible in a wide lesson banner.` : "Compose this as a clean landscape course cover in the requested image dimensions with the main subject clearly readable on desktop and mobile." : "Use a clear educational composition in the requested landscape dimensions."} ${courseImageStyleInstruction(options.imageStyle ?? "auto", options.customImageStyle)} Do not add words, labels, watermarks, logos, or captions to the image. Keep clear subject separation.`;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey)
    throw new DashboardError(
      "AI generation is not configured. Set OPENAI_API_KEY on the server.",
      503,
    );
  const model = process.env.OPENAI_TEXT_MODEL || defaultCourseGenerationModel;
  const imageSize = `${width}x${height}`;
  const imageOutputFormat = "webp";
  const imageOutputCompression = stepGuide ? 60 : generatedCourseImageOutputCompression;
  const imageToolSettings = {
    size: imageSize,
    output_format: imageOutputFormat,
    output_compression: imageOutputCompression,
    quality: imageQuality,
  };
  const usageContext = {
    operationId: randomUUID(), kind: "image" as const,
    stage: options.purpose ?? "lesson-illustration", attempt: 1,
    requestedModel: model, imageModel, courseId, startedAt: Date.now(),
    imageRequest: {
      size: imageSize,
      quality: imageQuality,
      outputFormat: imageOutputFormat,
      outputCompression: imageOutputCompression,
      imageCount: 1,
    },
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
            ...imageToolSettings,
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
    const providerError = body && typeof body === "object" && "error" in body
      && body.error && typeof body.error === "object" ? body.error : null;
    const errorParam = providerError && "param" in providerError && typeof providerError.param === "string" ? providerError.param : "";
    const errorCode = providerError && "code" in providerError && typeof providerError.code === "string" ? providerError.code : "";
    if (response.status === 400 && /(?:^|\.)size$/.test(errorParam))
      throw new DashboardError("The configured image model does not support the requested size. Check OPENAI_IMAGE_MODEL and its supported image dimensions.", 502);
    if (errorCode === "model_not_found")
      throw new DashboardError("The configured image model is unavailable to this account. Check OPENAI_IMAGE_MODEL and your provider model access.", 503);
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
  if (
    bytes.length > 25 * 1024 * 1024 ||
    !isWebp
  )
    throw new DashboardError(
      "The generated image did not pass file validation.",
      502,
    );
  try {
    const metadata = await sharp(bytes, { limitInputPixels: 40_000_000 }).metadata();
    if (metadata.format !== "webp" || metadata.width !== width || metadata.height !== height)
      throw new DashboardError(`The image service returned an invalid image or dimensions other than ${imageSize}.`, 502);

    // Preserve the exact API bytes; compression is controlled by the provider.
    if (!stepGuide && bytes.length > generatedCourseImageMaxBytes)
      throw new DashboardError("The image service returned an image larger than 200 KB. Try generating it again; the provider cannot guarantee an exact file size.", 502);
    return { bytes, mimeType: "image/webp", extension: "webp", width, height };
  } catch (error) {
    if (error instanceof DashboardError) throw error;
    throw new DashboardError("The generated image did not pass file validation.", 502);
  }
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
        imageQuality: options.imageQuality ?? "medium",
        imageModel: options.imageModel ?? (process.env.OPENAI_IMAGE_MODEL || defaultCourseImageGenerationModel),
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
