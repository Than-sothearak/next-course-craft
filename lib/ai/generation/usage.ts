import { createHash } from "node:crypto";
import { z } from "zod";
import { generationUsageCourseId } from "./usage-scope";

export type GenerationTokenUsage = {
  inputTokens: number | null;
  cachedInputTokens: number | null;
  cacheWriteTokens: number | null;
  cacheWrite30mTokens: number | null;
  cacheWrite12hTokens: number | null;
  outputTokens: number | null;
  reasoningTokens: number | null;
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
    const imageCalls = Array.isArray(body.output) ? body.output.flatMap((value: unknown) => {
      const item = objectRecord(value);
      if (item.type !== "image_generation_call") return [];
      const imageUsage = objectRecord(item.usage);
      const details = objectRecord(imageUsage.input_tokens_details);
      return [{
        model: identifier(item.model) ?? identifier(context.imageModel),
        usage: readGenerationTokenUsage(item.usage),
        textInputTokens: count(details.text_tokens),
        imageInputTokens: count(details.image_tokens),
      }];
    }) : [];
    const inputCostEstimate = estimateGenerationInputCost(pricingModel, pricingTier, usage);
    const rates = inputRates.get(pricingModel);
    const outputUsd = rates && (pricingTier === null || pricingTier === "default") && usage.inputTokens !== null && usage.outputTokens !== null
      ? usage.outputTokens * rates.output * (usage.inputTokens > 272_000 ? 1.5 : 1) / 1_000_000 : null;
    const textCostEstimate = {
      inputUsd: inputCostEstimate.usd, outputUsd,
      usd: inputCostEstimate.usd !== null && outputUsd !== null ? inputCostEstimate.usd + outputUsd : null,
      scope: "mainline_model_text_only", pricingAsOf,
    };
    const courseId = identifier(context.courseId ?? generationUsageCourseId());
    const event = {
      event: "ai.generation.usage",
      version: 1,
      at: new Date().toISOString(),
      operationId: identifier(context.operationId),
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
      actualModel,
      serviceTier,
      schemaHash: context.schemaHash ?? null,
      developerPromptHash: context.developerPromptHash ?? null,
      cachePolicy: context.cachePolicy ?? null,
      usage,
      inputCostEstimate,
      textCostEstimate,
      imageCalls,
    };
    const format = z.enum(["readable", "json", "both"]).catch("readable").parse(process.env.OPENAI_USAGE_LOG_FORMAT);
    if (format !== "readable") console.info(JSON.stringify(event));
    if (format !== "json") {
      const money = (usd: number | null) => usd === null ? "unknown" : `$${usd.toFixed(8)}`;
      const tokens = (n: number | null) => n === null ? "unknown" : n.toLocaleString("en-US");
      console.info(`[${event.at}] [COURSE COST] [Course: ${courseId ?? "unknown"}] [${(event.stage ?? "generation").replace(/_/g, " ")}] [Attempt: ${context.attempt}] [Estimated text ${context.kind === "image" ? "subtotal" : "total"}: ${money(textCostEstimate.usd)}] [Input: ${money(inputCostEstimate.usd)} | Output: ${money(outputUsd)}] [Tokens: ${tokens(usage.inputTokens)} in / ${tokens(usage.outputTokens)} out] [Cache: ${tokens(usage.cachedInputTokens)} read / ${tokens(usage.cacheWriteTokens)} written] [Time: ${(event.durationMs / 1000).toFixed(2)}s]${context.kind === "image" ? " [Image charges excluded]" : ""}`);
    }
  } catch {
    // A failing log sink must not alter the provider's result or retry budget.
  }
}
