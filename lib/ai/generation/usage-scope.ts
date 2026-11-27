import { randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";

type UsageValue = number | null;
type UsageAggregate = {
  id: string;
  courseId: string;
  startedAt: number;
  lastUpdatedAt: number;
  requests: number;
  failedRequests: number;
  retries: number;
  imageCostEstimatedRequests: number;
  imageCostCalculatedRequests: number;
  imageCostUnavailableRequests: number;
  generatedImageCount: number;
  imageUsageKnownRequests: number;
  values: Record<string, { sum: number; missing: number }>;
  hasImageRequest: boolean;
};
type Scope = { courseId: string; generationId: string; startedAt: number };
type UsageObservation = {
  courseId: string | null;
  generationId: string | null;
  kind: "text" | "image";
  attempt: number;
  outcome: string;
  httpStatus: number | null;
  providerStatus: string | null;
  durationMs: number;
  usage: {
    inputTokens: UsageValue;
    cachedInputTokens: UsageValue;
    cacheWriteTokens: UsageValue;
    outputTokens: UsageValue;
    reasoningTokens: UsageValue;
  };
  imageUsage: {
    inputTokens: UsageValue;
    cachedInputTokens: UsageValue;
    textInputTokens: UsageValue;
    cachedTextInputTokens: UsageValue;
    imageInputTokens: UsageValue;
    cachedImageInputTokens: UsageValue;
    textOutputTokens: UsageValue;
    imageOutputTokens: UsageValue;
    totalTokens: UsageValue;
  } | null;
  imageTokens: UsageValue;
  cacheSavingsUsd: UsageValue;
  inputCostUsd: UsageValue;
  textCostUsd: UsageValue;
  imageCostUsd: UsageValue;
  imageCostStatus: "calculated" | "estimated" | "unavailable" | null;
  generatedImageCount: number;
};

const courseScope = new AsyncLocalStorage<Scope>();
const aggregates = new Map<string, UsageAggregate>();
const retainedForMs = 24 * 60 * 60 * 1_000;
const maxAggregates = 500;
const trackedValues = [
  "inputTokens", "cachedInputTokens", "cacheWriteTokens", "outputTokens", "reasoningTokens",
  "imageToolInputTokens", "cachedImageToolInputTokens",
  "imageTextInputTokens", "cachedImageTextInputTokens", "imageInputTokens", "cachedImageInputTokens",
  "imageTextOutputTokens", "imageOutputTokens", "imageTotalTokens", "imageTokens",
  "cacheSavingsUsd", "inputCostUsd", "textCostUsd", "imageCostUsd", "durationMs",
] as const;

function aggregateFor(id: string, courseId: string, startedAt = Date.now()) {
  const existing = aggregates.get(id);
  if (existing) {
    existing.lastUpdatedAt = Date.now();
    return existing;
  }
  const values = Object.fromEntries(trackedValues.map((name) => [name, { sum: 0, missing: 0 }])) as UsageAggregate["values"];
  const aggregate: UsageAggregate = {
    id, courseId, startedAt, lastUpdatedAt: Date.now(), requests: 0, failedRequests: 0, retries: 0,
    imageCostEstimatedRequests: 0, imageCostCalculatedRequests: 0, imageCostUnavailableRequests: 0,
    generatedImageCount: 0, imageUsageKnownRequests: 0, values, hasImageRequest: false,
  };
  aggregates.set(id, aggregate);
  for (const [key, value] of aggregates) {
    if (Date.now() - value.lastUpdatedAt > retainedForMs) aggregates.delete(key);
  }
  while (aggregates.size > maxAggregates)
    aggregates.delete(aggregates.keys().next().value as string);
  return aggregate;
}

function addValue(aggregate: UsageAggregate, name: typeof trackedValues[number], value: UsageValue) {
  const counter = aggregate.values[name];
  if (value === null || !Number.isFinite(value)) counter.missing++;
  else counter.sum += value;
}

export function generationUsageId() {
  return courseScope.getStore()?.generationId ?? null;
}

export function generationUsageCourseId() {
  return courseScope.getStore()?.courseId;
}

export function recordGenerationUsage(observation: UsageObservation) {
  const scope = courseScope.getStore();
  const id = observation.generationId ?? scope?.generationId;
  const courseId = observation.courseId ?? scope?.courseId;
  if (!id || !courseId) return;
  const aggregate = aggregateFor(id, courseId, scope?.startedAt);
  aggregate.requests++;
  if (observation.attempt > 1) aggregate.retries++;
  if (observation.outcome !== "response_received" ||
    (observation.httpStatus !== null && observation.httpStatus >= 400) ||
    ["incomplete", "failed", "cancelled"].includes(observation.providerStatus ?? "")) aggregate.failedRequests++;
  aggregate.hasImageRequest ||= observation.kind === "image";
  aggregate.generatedImageCount += observation.generatedImageCount;
  if (observation.kind === "image") {
    if (observation.imageCostStatus === "estimated") aggregate.imageCostEstimatedRequests++;
    else if (observation.imageCostStatus === "calculated") aggregate.imageCostCalculatedRequests++;
    else aggregate.imageCostUnavailableRequests++;
  }
  addValue(aggregate, "inputTokens", observation.usage.inputTokens);
  addValue(aggregate, "cachedInputTokens", observation.usage.cachedInputTokens);
  addValue(aggregate, "cacheWriteTokens", observation.usage.cacheWriteTokens);
  addValue(aggregate, "outputTokens", observation.usage.outputTokens);
  addValue(aggregate, "reasoningTokens", observation.usage.reasoningTokens);
  const image = observation.imageUsage;
  if (observation.kind === "image" && image && Object.values(image).some((value) => value !== null))
    aggregate.imageUsageKnownRequests++;
  addValue(aggregate, "imageToolInputTokens", observation.kind === "image" ? image?.inputTokens ?? null : 0);
  addValue(aggregate, "cachedImageToolInputTokens", observation.kind === "image" ? image?.cachedInputTokens ?? null : 0);
  addValue(aggregate, "imageTextInputTokens", observation.kind === "image" ? image?.textInputTokens ?? null : 0);
  addValue(aggregate, "cachedImageTextInputTokens", observation.kind === "image" ? image?.cachedTextInputTokens ?? null : 0);
  addValue(aggregate, "imageInputTokens", observation.kind === "image" ? image?.imageInputTokens ?? null : 0);
  addValue(aggregate, "cachedImageInputTokens", observation.kind === "image" ? image?.cachedImageInputTokens ?? null : 0);
  addValue(aggregate, "imageTextOutputTokens", observation.kind === "image" ? image?.textOutputTokens ?? null : 0);
  addValue(aggregate, "imageOutputTokens", observation.kind === "image" ? image?.imageOutputTokens ?? null : 0);
  addValue(aggregate, "imageTotalTokens", observation.kind === "image" ? image?.totalTokens ?? null : 0);
  addValue(aggregate, "imageTokens", observation.imageTokens);
  addValue(aggregate, "cacheSavingsUsd", observation.cacheSavingsUsd);
  addValue(aggregate, "inputCostUsd", observation.inputCostUsd);
  addValue(aggregate, "textCostUsd", observation.textCostUsd);
  addValue(aggregate, "imageCostUsd", observation.kind === "image" ? observation.imageCostUsd : 0);
  addValue(aggregate, "durationMs", observation.durationMs);
}

export function adoptGenerationUsageId(id: string) {
  const scope = courseScope.getStore();
  if (!scope) return;
  const previous = aggregates.get(scope.generationId);
  scope.generationId = id;
  if (previous) {
    aggregates.delete(previous.id);
    const next = aggregates.get(id);
    if (next) {
      next.requests += previous.requests;
      next.failedRequests += previous.failedRequests;
      next.retries += previous.retries;
      next.imageCostEstimatedRequests += previous.imageCostEstimatedRequests;
      next.imageCostCalculatedRequests += previous.imageCostCalculatedRequests;
      next.imageCostUnavailableRequests += previous.imageCostUnavailableRequests;
      next.generatedImageCount += previous.generatedImageCount;
      next.imageUsageKnownRequests += previous.imageUsageKnownRequests;
      next.hasImageRequest ||= previous.hasImageRequest;
      for (const name of trackedValues) {
        next.values[name].sum += previous.values[name].sum;
        next.values[name].missing += previous.values[name].missing;
      }
    } else {
      previous.id = id;
      aggregates.set(id, previous);
    }
  }
}

function completeValue(aggregate: UsageAggregate, name: typeof trackedValues[number]) {
  const counter = aggregate.values[name];
  return counter.missing === 0 && aggregate.requests > 0 ? counter.sum : null;
}

export function generationUsageSummary(id: string) {
  const aggregate = aggregates.get(id);
  if (!aggregate) return null;
  const inputTokens = completeValue(aggregate, "inputTokens");
  const cachedInputTokens = completeValue(aggregate, "cachedInputTokens");
  const outputTokens = completeValue(aggregate, "outputTokens");
  const imageTokens = completeValue(aggregate, "imageTokens");
  const imageTextInputTokens = completeValue(aggregate, "imageTextInputTokens");
  const cachedImageTextInputTokens = completeValue(aggregate, "cachedImageTextInputTokens");
  const imageInputTokens = completeValue(aggregate, "imageInputTokens");
  const cachedImageInputTokens = completeValue(aggregate, "cachedImageInputTokens");
  const imageTextOutputTokens = completeValue(aggregate, "imageTextOutputTokens");
  const imageOutputTokens = completeValue(aggregate, "imageOutputTokens");
  const imageTotalTokens = completeValue(aggregate, "imageTotalTokens");
  const imageToolInputTokens = completeValue(aggregate, "imageToolInputTokens");
  const cachedImageToolInputTokens = completeValue(aggregate, "cachedImageToolInputTokens");
  const cacheWriteTokens = completeValue(aggregate, "cacheWriteTokens");
  const reasoningTokens = completeValue(aggregate, "reasoningTokens");
  const textGenerationCostUsd = completeValue(aggregate, "textCostUsd");
  const imageGenerationCostUsd = aggregate.imageCostUnavailableRequests > 0
    ? null
    : completeValue(aggregate, "imageCostUsd");
  const recordedTextTokens = aggregate.requests > aggregate.values.inputTokens.missing ||
    aggregate.requests > aggregate.values.outputTokens.missing || aggregate.imageUsageKnownRequests > 0
    ? aggregate.values.inputTokens.sum + aggregate.values.outputTokens.sum +
      aggregate.values.imageTextInputTokens.sum + aggregate.values.imageTextOutputTokens.sum
    : null;
  const recordedImageTokens = !aggregate.hasImageRequest
    ? 0
    : imageInputTokens !== null && imageOutputTokens !== null
      ? imageInputTokens + imageOutputTokens
      : null;
  const anyUsageRecorded = inputTokens !== null || outputTokens !== null || imageTotalTokens !== null;
  const imageBreakdownComplete = !aggregate.hasImageRequest || (
    imageTextInputTokens !== null && imageInputTokens !== null &&
    imageTextOutputTokens !== null && imageOutputTokens !== null && imageTotalTokens !== null
  );
  const usageCompleteness = !anyUsageRecorded
    ? "unavailable" as const
    : inputTokens !== null && outputTokens !== null && imageBreakdownComplete
      ? "complete" as const
      : "partial" as const;
  return {
    courseId: aggregate.courseId,
    startedAt: aggregate.startedAt,
    requests: aggregate.requests,
    failedRequests: aggregate.failedRequests,
    retries: aggregate.retries,
    generatedImageCount: aggregate.generatedImageCount,
    inputTokens,
    cachedInputTokens,
    cacheWriteTokens,
    uncachedInputTokens: inputTokens !== null && cachedInputTokens !== null ? inputTokens - cachedInputTokens : null,
    outputTokens,
    reasoningTokens,
    imageTextInputTokens,
    cachedImageTextInputTokens,
    imageInputTokens,
    cachedImageInputTokens,
    imageTextOutputTokens,
    imageOutputTokens,
    imageTotalTokens,
    imageToolInputTokens,
    cachedImageToolInputTokens,
    imageTokens: aggregate.hasImageRequest ? imageTokens : 0,
    recordedTextTokens,
    recordedImageTokens,
    totalTokens: inputTokens !== null && outputTokens !== null && imageTotalTokens !== null
      ? inputTokens + outputTokens + imageTotalTokens
      : null,
    usageCompleteness,
    cacheHitPercent: inputTokens && cachedInputTokens !== null && inputTokens > 0 ? cachedInputTokens / inputTokens * 100 : null,
    imageCacheHitPercent: imageToolInputTokens && cachedImageToolInputTokens !== null && imageToolInputTokens > 0
      ? cachedImageToolInputTokens / imageToolInputTokens * 100
      : null,
    estimatedCacheSavingsUsd: completeValue(aggregate, "cacheSavingsUsd"),
    textGenerationCostUsd,
    imageGenerationCostUsd,
    imageGenerationCostStatus: aggregate.imageCostUnavailableRequests > 0
      ? "unavailable" as const
      : aggregate.imageCostEstimatedRequests > 0
        ? "estimated" as const
        : "calculated" as const,
    combinedGenerationCostUsd: textGenerationCostUsd === null || imageGenerationCostUsd === null
      ? null
      : textGenerationCostUsd + imageGenerationCostUsd,
    activeProcessingMs: completeValue(aggregate, "durationMs"),
  };
}

export function generationUsageSummaryFields(summary: ReturnType<typeof generationUsageSummary> | null) {
  return {
    cacheWriteTokens: summary?.cacheWriteTokens ?? null,
    reasoningTokens: summary?.reasoningTokens ?? null,
    imageTextInputTokens: summary?.imageTextInputTokens ?? null,
    cachedImageTextInputTokens: summary?.cachedImageTextInputTokens ?? null,
    imageInputTokens: summary?.imageInputTokens ?? null,
    cachedImageInputTokens: summary?.cachedImageInputTokens ?? null,
    imageTextOutputTokens: summary?.imageTextOutputTokens ?? null,
    imageOutputTokens: summary?.imageOutputTokens ?? null,
    imageTotalTokens: summary?.imageTotalTokens ?? null,
    imageCacheHitPercent: summary?.imageCacheHitPercent ?? null,
    recordedTextTokens: summary?.recordedTextTokens ?? null,
    recordedImageTokens: summary?.recordedImageTokens ?? null,
    usageCompleteness: summary?.usageCompleteness ?? "unavailable" as const,
    imageGenerationCostStatus: summary?.imageGenerationCostStatus ?? "unavailable" as const,
  };
}

export function withCourseUsage<ScopeInput extends { courseId: string }, Args extends unknown[], Result>(
  work: (scope: ScopeInput, ...args: Args) => Result,
): (scope: ScopeInput, ...args: Args) => Result;
export function withCourseUsage<ScopeInput extends { courseId: string }, Args extends unknown[], Result>(
  work: (scope: ScopeInput, ...args: Args) => Result,
  resolveId: (scope: ScopeInput, ...args: Args) => string | undefined,
): (scope: ScopeInput, ...args: Args) => Result;
export function withCourseUsage<ScopeInput extends { courseId: string }, Args extends unknown[], Result>(
  work: (scope: ScopeInput, ...args: Args) => Result,
  resolveId?: (scope: ScopeInput, ...args: Args) => string | undefined,
) {
  return (scope: ScopeInput, ...args: Args): Result => {
    const id = resolveId?.(scope, ...args) ?? randomUUID();
    return courseScope.run({ courseId: scope.courseId, generationId: id, startedAt: Date.now() }, () => work(scope, ...args));
  };
}
