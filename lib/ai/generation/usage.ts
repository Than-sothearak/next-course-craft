import { createHash } from "node:crypto";
import { z } from "zod";
import { generationUsageCourseId, generationUsageId, recordGenerationUsage } from "./usage-scope";
import { generationLogLevelEnabled, shortGenerationId, writeGenerationLog } from "./progress-log";

export type GenerationTokenUsage = {
  inputTokens: number | null;
  cachedInputTokens: number | null;
  cacheWriteTokens: number | null;
  cacheWrite30mTokens: number | null;
  cacheWrite12hTokens: number | null;
  outputTokens: number | null;
  reasoningTokens: number | null;
};

export type ImageGenerationTokenUsage = {
  inputTokens: number | null;
  textInputTokens: number | null;
  imageInputTokens: number | null;
  cachedInputTokens: number | null;
  cachedTextInputTokens: number | null;
  cachedImageInputTokens: number | null;
  outputTokens: number | null;
  textOutputTokens: number | null;
  imageOutputTokens: number | null;
  totalTokens: number | null;
};

export type ImageGenerationRequest = {
  size: string;
  quality: string;
  outputFormat: string | null;
  outputCompression: number | null;
  imageCount: number;
};

export type GenerationUsageContext = {
  operationId: string;
  courseId?: string;
  kind: "text" | "image";
  stage: string;
  attempt: number;
  requestedModel: string;
  startedAt: number;
  schemaHash?: string;
  developerPromptHash?: string;
  imageModel?: string;
  imageRequest?: ImageGenerationRequest;
  cachePolicy?: "shared_developer_v1" | "provider_default";
};

const countSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const pricingAsOf = "2026-11-27";
// Standard USD per million tokens. Keep this deliberately limited to verified
// model IDs; an unknown model/snapshot or processing tier must not inherit rates.
// https://developers.openai.com/api/docs/pricing#standard-pricing-data
const inputRates = new Map([
  ["gpt-6-luna", { input: 0.1, cached: 0.01, output: 0.5 }],
  ["gpt-6-astra", { input: 10, cached: 1, output: 50 }],
  ["gpt-6.1-sol", { input: 2, cached: 0.1, output: 10 }],
]);
const imageRates = new Map([
  ["gpt-image-2.6-flare", { textInput: 5, cachedTextInput: 1.25, imageInput: 8, cachedImageInput: 2, imageOutput: 30 }],
]);

function objectRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

function count(value: unknown) {
  const parsed = countSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function identifier(value: unknown) {
  return typeof value === "string" && /^[a-zA-Z0-9_.:/-]{1,160}$/.test(value) ? value : null;
}

export function generationUsageHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function readGenerationTokenUsage(value: unknown): GenerationTokenUsage {
  const usage = objectRecord(value);
  const input = objectRecord(usage.input_tokens_details);
  const writes = objectRecord(input.cache_write_tokens_details);
  return {
    inputTokens: count(usage.input_tokens),
    cachedInputTokens: count(input.cached_tokens),
    cacheWriteTokens: count(input.cache_write_tokens),
    cacheWrite30mTokens: count(writes.ttl_30m_tokens),
    cacheWrite12hTokens: count(writes.ttl_12h_tokens),
    outputTokens: count(usage.output_tokens),
    reasoningTokens: count(objectRecord(usage.output_tokens_details).reasoning_tokens),
  };
}

export function readImageGenerationTokenUsage(value: unknown): ImageGenerationTokenUsage {
  const usage = objectRecord(value);
  const input = objectRecord(usage.input_tokens_details);
  const cached = objectRecord(usage.cached_tokens_details);
  const output = objectRecord(usage.output_tokens_details);
  const inputTokens = count(usage.input_tokens);
  const textInputTokens = count(input.text_tokens);
  const imageInputTokens = count(input.image_tokens);
  const reportedCachedTextInputTokens = count(cached.cached_text_tokens);
  const reportedCachedImageInputTokens = count(cached.cached_image_tokens);
  const cachedInputTokens = count(usage.cached_tokens) ??
    (reportedCachedTextInputTokens !== null && reportedCachedImageInputTokens !== null
      ? reportedCachedTextInputTokens + reportedCachedImageInputTokens
      : null);
  const outputTokens = count(usage.output_tokens);
  const reportedTextOutputTokens = count(output.text_tokens);
  const imageOutputTokens = count(output.image_tokens) ??
    (reportedTextOutputTokens === null || reportedTextOutputTokens === 0 ? outputTokens : null);
  const textOutputTokens = reportedTextOutputTokens ??
    (outputTokens !== null && imageOutputTokens !== null && imageOutputTokens <= outputTokens
      ? outputTokens - imageOutputTokens
      : null);
  return {
    inputTokens,
    textInputTokens,
    imageInputTokens,
    cachedInputTokens,
    cachedTextInputTokens: reportedCachedTextInputTokens ?? (cachedInputTokens === 0 ? 0 : null),
    cachedImageInputTokens: reportedCachedImageInputTokens ?? (cachedInputTokens === 0 ? 0 : null),
    outputTokens,
    textOutputTokens,
    imageOutputTokens,
    totalTokens: count(usage.total_tokens) ??
      (inputTokens !== null && outputTokens !== null ? inputTokens + outputTokens : null),
  };
}

function estimateImageGenerationCost(model: string | null, usage: ImageGenerationTokenUsage) {
  const result = {
    usd: null as number | null,
    inputTextUsd: null as number | null,
    inputImageUsd: null as number | null,
    outputImageUsd: null as number | null,
    status: "unavailable" as "calculated" | "estimated" | "unavailable",
    unavailableReason: null as "unsupported_model" | "incomplete_usage" | "inconsistent_usage" | null,
    pricingAsOf,
    cacheAssumption: null as string | null,
  };
  const rates = model ? imageRates.get(model) : undefined;
  if (!rates) return { ...result, unavailableReason: "unsupported_model" as const };
  const { textInputTokens, imageInputTokens, imageOutputTokens, cachedInputTokens, cachedTextInputTokens, cachedImageInputTokens } = usage;
  if (textInputTokens === null || imageInputTokens === null || imageOutputTokens === null)
    return { ...result, unavailableReason: "incomplete_usage" as const };
  if (
    (usage.inputTokens !== null && textInputTokens !== null && imageInputTokens !== null &&
      usage.inputTokens !== textInputTokens + imageInputTokens) ||
    (usage.outputTokens !== null && usage.textOutputTokens !== null && usage.imageOutputTokens !== null &&
      usage.outputTokens !== usage.textOutputTokens + usage.imageOutputTokens) ||
    (usage.totalTokens !== null && usage.inputTokens !== null && usage.outputTokens !== null &&
      usage.totalTokens !== usage.inputTokens + usage.outputTokens) ||
    (cachedInputTokens !== null && usage.inputTokens !== null && cachedInputTokens > usage.inputTokens) ||
    (usage.outputTokens !== null && imageOutputTokens > usage.outputTokens) ||
    (cachedTextInputTokens !== null && cachedTextInputTokens > textInputTokens) ||
    (cachedImageInputTokens !== null && cachedImageInputTokens > imageInputTokens) ||
    (cachedInputTokens !== null && (
      cachedTextInputTokens !== null && cachedInputTokens < cachedTextInputTokens ||
      cachedImageInputTokens !== null && cachedInputTokens < cachedImageInputTokens
    )) ||
    (cachedTextInputTokens !== null && cachedImageInputTokens !== null &&
      cachedInputTokens !== null && cachedTextInputTokens + cachedImageInputTokens !== cachedInputTokens) ||
    (cachedInputTokens !== null && cachedInputTokens === 0 &&
      ((cachedTextInputTokens ?? 0) > 0 || (cachedImageInputTokens ?? 0) > 0))
  ) return { ...result, unavailableReason: "inconsistent_usage" as const };

  const cachedText = cachedTextInputTokens ?? 0;
  const cachedImage = cachedImageInputTokens ?? 0;
  const inputTextUsd = ((textInputTokens - cachedText) * rates.textInput + cachedText * rates.cachedTextInput) / 1_000_000;
  const inputImageUsd = ((imageInputTokens - cachedImage) * rates.imageInput + cachedImage * rates.cachedImageInput) / 1_000_000;
  const outputImageUsd = imageOutputTokens * rates.imageOutput / 1_000_000;
  const cacheBreakdownComplete = (cachedTextInputTokens !== null && cachedImageInputTokens !== null) ||
    cachedInputTokens === 0;
  return {
    ...result,
    usd: inputTextUsd + inputImageUsd + outputImageUsd,
    inputTextUsd,
    inputImageUsd,
    outputImageUsd,
    status: cacheBreakdownComplete ? "calculated" as const : "estimated" as const,
    cacheAssumption: cacheBreakdownComplete
      ? null
      : "Cached input breakdown unavailable; unreported cached input is priced at standard input rates.",
  };
}

export function estimateGenerationInputCost(model: string, serviceTier: string | null, usage: GenerationTokenUsage) {
  const estimate = {
    usd: null as number | null,
    unavailableReason: null as "unsupported_model" | "unsupported_service_tier" | "incomplete_usage" | "inconsistent_usage" | null,
    pricingAsOf,
    scope: "mainline_model_input_only" as const,
    assumedStandardTier: serviceTier === null,
  };
  const rates = inputRates.get(model);
  if (!rates) return { ...estimate, unavailableReason: "unsupported_model" as const };
  if (serviceTier !== null && serviceTier !== "default")
    return { ...estimate, unavailableReason: "unsupported_service_tier" as const };
  const { inputTokens, cachedInputTokens, cacheWriteTokens, cacheWrite30mTokens, cacheWrite12hTokens } = usage;
  if (inputTokens === null || cachedInputTokens === null || cacheWriteTokens === null)
    return { ...estimate, unavailableReason: "incomplete_usage" as const };
  if (cachedInputTokens + cacheWriteTokens > inputTokens ||
    (cacheWrite30mTokens !== null && cacheWrite30mTokens > cacheWriteTokens) ||
    (cacheWrite12hTokens !== null && cacheWrite12hTokens > cacheWriteTokens))
    return { ...estimate, unavailableReason: "inconsistent_usage" as const };
  // A reported zero total needs no lifetime inference. Nonzero writes require
  // both measured lifetime buckets; never guess their TTL from request defaults.
  const writes30m = cacheWrite30mTokens ?? (cacheWriteTokens === 0 ? 0 : null);
  const writes12h = cacheWrite12hTokens ?? (cacheWriteTokens === 0 ? 0 : null);
  if (writes30m === null || writes12h === null)
    return { ...estimate, unavailableReason: "incomplete_usage" as const };
  if (writes30m + writes12h !== cacheWriteTokens)
    return { ...estimate, unavailableReason: "inconsistent_usage" as const };
  const ordinary = inputTokens - cachedInputTokens - cacheWriteTokens;
  const contextMultiplier = inputTokens > 272_000 ? 2 : 1;
  // Write prices replace ordinary input pricing; they are not additive fees.
  return { ...estimate, usd: contextMultiplier * (
    ordinary * rates.input + cachedInputTokens * rates.cached +
    writes30m * rates.input * 1.25 + writes12h * rates.input * 2.5
  ) / 1_000_000 };
}

export function logGenerationUsage(context: GenerationUsageContext, observation: {
  response?: Response;
  body?: unknown;
  transportErrorCode?: string;
}) {
  // Observability must never fail generation or cause a duplicate paid retry.
  try {
    const body = objectRecord(observation.body);
    const actualModel = identifier(body.model);
    const serviceTier = identifier(body.service_tier);
    const pricingModel = body.model == null ? context.requestedModel : actualModel ?? "unknown";
    const pricingTier = body.service_tier == null ? null : serviceTier ?? "unknown";
    const usage = readGenerationTokenUsage(body.usage);
    const imageItems = Array.isArray(body.output) ? body.output.flatMap((value: unknown) => {
      const item = objectRecord(value);
      if (item.type !== "image_generation_call") return [];
      return [{
        model: identifier(context.imageModel),
        status: identifier(item.status),
        outputFormat: identifier(item.output_format),
        quality: identifier(item.quality),
        size: identifier(item.size),
        generated: typeof item.result === "string" && item.result.length > 0,
      }];
    }) : [];
    const imageUsage = readImageGenerationTokenUsage(objectRecord(body.tool_usage).image_gen);
    const inputCostEstimate = estimateGenerationInputCost(pricingModel, pricingTier, usage);
    const rates = inputRates.get(pricingModel);
    const outputUsd = rates && (pricingTier === null || pricingTier === "default") && usage.inputTokens !== null && usage.outputTokens !== null
      ? usage.outputTokens * rates.output * (usage.inputTokens > 272_000 ? 1.5 : 1) / 1_000_000 : null;
    const textCostEstimate = {
      inputUsd: inputCostEstimate.usd, outputUsd,
      usd: inputCostEstimate.usd !== null && outputUsd !== null ? inputCostEstimate.usd + outputUsd : null,
      scope: "mainline_model_text_only", pricingAsOf,
    };
    const imageModel = identifier(context.imageModel);
    const imageCostEstimate = context.kind === "image"
      ? estimateImageGenerationCost(imageModel, imageUsage)
      : null;
    const courseId = identifier(context.courseId ?? generationUsageCourseId());
    const generationId = generationUsageId();
    const imageTokens = context.kind === "image" && imageUsage.imageInputTokens !== null && imageUsage.imageOutputTokens !== null
      ? imageUsage.imageInputTokens + imageUsage.imageOutputTokens
      : context.kind === "image" ? null : 0;
    const cacheSavingsEstimate = rates && (pricingTier === null || pricingTier === "default") &&
      usage.inputTokens !== null && usage.cachedInputTokens !== null && usage.cachedInputTokens <= usage.inputTokens
      ? usage.cachedInputTokens * (rates.input - rates.cached) * (usage.inputTokens > 272_000 ? 2 : 1) / 1_000_000
      : null;
    const imageCacheSavingsEstimate = imageCostEstimate && imageUsage.cachedTextInputTokens !== null &&
      imageUsage.cachedImageInputTokens !== null && imageRates.get(imageModel ?? "") &&
      imageUsage.textInputTokens !== null && imageUsage.imageInputTokens !== null
      ? imageUsage.cachedTextInputTokens * (imageRates.get(imageModel ?? "")!.textInput - imageRates.get(imageModel ?? "")!.cachedTextInput) / 1_000_000 +
        imageUsage.cachedImageInputTokens * (imageRates.get(imageModel ?? "")!.imageInput - imageRates.get(imageModel ?? "")!.cachedImageInput) / 1_000_000
      : context.kind === "image" && imageUsage.cachedInputTokens === 0 ? 0 : null;
    const totalCacheSavingsEstimate = cacheSavingsEstimate !== null &&
      (context.kind !== "image" || imageCacheSavingsEstimate !== null)
      ? cacheSavingsEstimate + (imageCacheSavingsEstimate ?? 0)
      : null;
    const generatedImageCount = imageItems.filter((item) => item.generated).length;
    const event = {
      event: "ai.generation.usage",
      category: "AI COST",
      operationCategory: context.kind === "image" ? "AI IMAGE" : "AI TEXT",
      version: 1,
      at: new Date().toISOString(),
      operationId: identifier(context.operationId),
      generationId: identifier(generationId),
      courseId,
      kind: context.kind,
      stage: identifier(context.stage),
      attempt: context.attempt,
      durationMs: Math.max(0, Date.now() - context.startedAt),
      outcome: observation.response ? "response_received" : "transport_error",
      httpStatus: observation.response?.status ?? null,
      requestId: identifier(observation.response?.headers.get("x-request-id")),
      responseId: identifier(body.id),
      providerStatus: identifier(body.status),
      providerErrorCode: identifier(objectRecord(body.error).code),
      transportErrorCode: identifier(observation.transportErrorCode),
      requestedModel: identifier(context.requestedModel),
      requestedImageModel: identifier(context.imageModel),
      imageGeneration: context.kind === "image" ? {
        model: imageModel,
        size: imageItems.find((item) => item.size)?.size ?? context.imageRequest?.size ?? null,
        quality: imageItems.find((item) => item.quality)?.quality ?? context.imageRequest?.quality ?? null,
        outputFormat: imageItems.find((item) => item.outputFormat)?.outputFormat ?? context.imageRequest?.outputFormat ?? null,
        outputCompression: context.imageRequest?.outputCompression ?? null,
        requestedImageCount: context.imageRequest?.imageCount ?? 1,
        generatedImageCount,
        durationMs: Math.max(0, Date.now() - context.startedAt),
      } : null,
      actualModel,
      serviceTier,
      schemaHash: context.schemaHash ?? null,
      developerPromptHash: context.developerPromptHash ?? null,
      cachePolicy: context.cachePolicy ?? null,
      usage,
      imageUsage: context.kind === "image" ? imageUsage : null,
      inputCostEstimate,
      textCostEstimate,
      imageCostEstimate,
      cacheSavingsEstimate: totalCacheSavingsEstimate,
      imageCalls: imageItems,
    };
    recordGenerationUsage({
      courseId,
      generationId,
      kind: context.kind,
      attempt: context.attempt,
      outcome: event.outcome,
      httpStatus: event.httpStatus,
      providerStatus: event.providerStatus,
      durationMs: event.durationMs,
      usage,
      imageUsage: context.kind === "image" ? imageUsage : null,
      imageTokens,
      cacheSavingsUsd: totalCacheSavingsEstimate,
      inputCostUsd: inputCostEstimate.usd,
      textCostUsd: textCostEstimate.usd,
      imageCostUsd: imageCostEstimate?.usd ?? null,
      imageCostStatus: imageCostEstimate?.status ?? null,
      generatedImageCount,
    });
    if (!generationLogLevelEnabled("COST")) return;
    const configuredUsageFormat = z.enum(["readable", "json", "both"]).safeParse(process.env.OPENAI_USAGE_LOG_FORMAT);
    const format = process.env.LOG_FORMAT?.toLowerCase() === "json"
      ? "json"
      : configuredUsageFormat.success
      ? configuredUsageFormat.data
      : "readable";
    if (format !== "readable") console.info(JSON.stringify(event));
    if (format !== "json") {
      const money = (usd: number | null) => usd === null ? "Unavailable" : `$${usd.toFixed(8)}`;
      const tokens = (n: number | null) => n === null ? "Unavailable" : n.toLocaleString("en-US");
      const total = usage.inputTokens !== null && usage.outputTokens !== null ? usage.inputTokens + usage.outputTokens : null;
      const cachePercent = usage.inputTokens && usage.cachedInputTokens !== null && usage.inputTokens > 0
        ? `${(usage.cachedInputTokens / usage.inputTokens * 100).toFixed(1)}%`
        : "Unavailable";
      const imageCachePercent = imageUsage.inputTokens && imageUsage.cachedInputTokens !== null && imageUsage.inputTokens > 0
        ? `${(imageUsage.cachedInputTokens / imageUsage.inputTokens * 100).toFixed(1)}%`
        : "Unavailable";
      const model = actualModel ?? context.requestedModel;
      const uncachedInputTokens = usage.inputTokens !== null && usage.cachedInputTokens !== null &&
        usage.cachedInputTokens <= usage.inputTokens ? usage.inputTokens - usage.cachedInputTokens : null;
      const combinedCost = textCostEstimate.usd !== null && imageCostEstimate !== null && imageCostEstimate.usd !== null
        ? money(textCostEstimate.usd + imageCostEstimate.usd)
        : context.kind === "image" ? "Unavailable" : money(textCostEstimate.usd);
      const details: Record<string, unknown> = {
        course: shortGenerationId(courseId ?? undefined) ?? "Unavailable",
        ...(generationId ? { run: shortGenerationId(generationId) } : {}),
        provider: "OpenAI",
        model,
        operation: (event.stage ?? "generation").replace(/_/g, " "),
        attempt: context.attempt,
        status: observation.response
          ? `HTTP ${observation.response.status}${event.providerStatus ? `/${event.providerStatus}` : ""}`
          : `transport error${event.transportErrorCode ? `/${event.transportErrorCode}` : ""}`,
        duration: `${(event.durationMs / 1000).toFixed(2)}s`,
        ...(event.requestId ? { requestId: event.requestId } : {}),
        ...(event.responseId ? { responseId: event.responseId } : {}),
        ...(event.serviceTier ? { serviceTier: event.serviceTier } : {}),
        ...(context.kind === "image" ? { imageModel: imageModel ?? "Unavailable" } : {}),
      };
      const imageDuration = event.durationMs > 60_000
        ? `${Math.floor(event.durationMs / 60_000)}m ${Math.floor(event.durationMs % 60_000 / 1_000).toString().padStart(2, "0")}s`
        : `${(event.durationMs / 1_000).toFixed(2)}s`;
      const requestLabel = context.kind === "image" ? "Image request" : "Text request";
      const imageRequest = event.imageGeneration;
      const requestStatus = observation.response
        ? `HTTP ${observation.response.status}${event.providerStatus ? `/${event.providerStatus}` : ""}`
        : `transport error${event.transportErrorCode ? `/${event.transportErrorCode}` : ""}`;
      const totalDisplayTokens = total !== null && (context.kind !== "image" || imageUsage.totalTokens !== null)
        ? total + (context.kind === "image" ? imageUsage.totalTokens ?? 0 : 0)
        : null;
      const moneyLabel = (value: number | null) => value === null ? "Unavailable" : `$${value.toFixed(8)}`;
      const omitZero = (label: string, value: number | null) => value === 0 ? null : `${label} ${tokens(value)}`;
      const textTokenParts = [
        omitZero("input", usage.inputTokens),
        omitZero("cached", usage.cachedInputTokens),
        omitZero("uncached", uncachedInputTokens),
        omitZero("output", usage.outputTokens),
        omitZero("total", total),
        omitZero("cache write", usage.cacheWriteTokens),
        omitZero("reasoning (included)", usage.reasoningTokens),
        `cache hit ${cachePercent}`,
      ].filter((part): part is string => part !== null);
      const imageTextParts = [
        omitZero("input", imageUsage.textInputTokens),
        omitZero("cached", imageUsage.cachedTextInputTokens),
      ].filter((part): part is string => part !== null);
      const imageParts = [
        omitZero("input", imageUsage.imageInputTokens),
        omitZero("cached", imageUsage.cachedImageInputTokens),
        omitZero("output", imageUsage.imageOutputTokens),
      ].filter((part): part is string => part !== null);
      const imageCostStatusLabel = imageCostEstimate?.status === "calculated" ? "calculated"
        : imageCostEstimate?.status === "estimated" ? "estimated" : "Unavailable";
      const compactLines = [
        "Provider   OpenAI",
        `Model      ${model}${context.kind === "image" ? `  →  ${imageModel ?? "Unavailable"}` : ""}`,
        ...(context.kind === "image" && imageRequest ? [
          `Settings   ${imageRequest.size ?? "Unavailable"} · ${imageRequest.quality ?? "Unavailable"} · ${imageRequest.outputFormat ?? "provider default"} · ${imageRequest.generatedImageCount}/${imageRequest.requestedImageCount} generated · ${imageDuration}`,
        ] : []),
        `Operation  ${(event.stage ?? "generation").replace(/_/g, " ")} · attempt ${context.attempt} · ${shortGenerationId(courseId ?? undefined) ?? "Unavailable"}${generationId ? ` / ${shortGenerationId(generationId)}` : ""}${context.kind === "text" ? ` · ${imageDuration}` : ""}`,
        `Text       ${textTokenParts.length ? textTokenParts.join(" · ") : "Unavailable"}`,
        ...(context.kind === "image" ? [
          ...(imageTextParts.length ? [`Image text ${imageTextParts.join(" · ")}`] : []),
          ...(imageParts.length ? [`Image      ${imageParts.join(" · ")}`] : []),
          `Total      ${tokens(totalDisplayTokens)} recorded · image cache hit ${imageCachePercent}`,
        ] : []),
        `ESTIMATED COST  Text ${moneyLabel(textCostEstimate.usd)}${context.kind === "image" ? ` · Image ${moneyLabel(imageCostEstimate?.usd ?? null)} · Combined ${combinedCost} · image ${imageCostStatusLabel}` : ` · Combined ${combinedCost}`}`,
        ...(imageCostEstimate?.cacheAssumption ? [`           ${imageCostEstimate.cacheAssumption}`] : []),
      ];
      const structuredFields = {
        ...details,
        imageGeneration: event.imageGeneration,
        imageUsage,
        imageCostEstimate,
        textCostEstimate,
        cacheHitPercent: cachePercent,
        cacheSavingsEstimate: totalCacheSavingsEstimate,
        totalTokens: totalDisplayTokens,
        reasoningTokens: usage.reasoningTokens,
        cacheWriteTokens: usage.cacheWriteTokens,
        courseId,
      };
      writeGenerationLog(
        "COST",
        "AI COST",
        `${requestLabel} (${requestStatus})`,
        structuredFields,
        console.info,
        "human",
        new Date(event.at),
        { layout: "compact-multiline", tone: "COST", lines: compactLines },
      );
      if (generationLogLevelEnabled("DEBUG")) {
        writeGenerationLog("DEBUG", "AI COST", `${requestLabel} diagnostics`, {
          ...details,
          operationId: event.operationId,
          generationId: event.generationId,
          requestedImageModel: event.requestedImageModel,
          actualModel: event.actualModel,
          requestId: event.requestId,
          responseId: event.responseId,
          serviceTier: event.serviceTier,
          providerStatus: event.providerStatus,
          usage,
          imageUsage,
          inputCostEstimate,
          textCostEstimate,
          imageCostEstimate,
          cacheSavingsEstimate: totalCacheSavingsEstimate,
          imageGeneration: event.imageGeneration,
          imageCalls: imageItems,
          courseId,
        }, console.info, "human", new Date(event.at), {
          layout: "multiline",
          tone: "DEBUG",
          sections: [{ title: "Request diagnostics", fields: {
            ...details,
            operationId: event.operationId,
            generationId: event.generationId,
            requestedImageModel: event.requestedImageModel,
            actualModel: event.actualModel,
            requestId: event.requestId,
            responseId: event.responseId,
            serviceTier: event.serviceTier,
            providerStatus: event.providerStatus,
            usage: JSON.stringify(usage),
            imageUsage: JSON.stringify(imageUsage),
            imageCostEstimate: JSON.stringify(imageCostEstimate),
            courseId,
          } }],
        });
      }
    }
  } catch {
    // A failing log sink must not alter the provider's result or retry budget.
  }
}
