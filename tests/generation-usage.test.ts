import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { estimateGenerationInputCost, logGenerationUsage, readGenerationTokenUsage } from "@/lib/ai/generation/usage";

const measured = {
  input_tokens: 12_000,
  input_tokens_details: {
    cached_tokens: 4_000,
    cache_write_tokens: 7_000,
    cache_write_tokens_details: { ttl_30m_tokens: 3_000, ttl_12h_tokens: 4_000 },
  },
  output_tokens: 250,
  output_tokens_details: { reasoning_tokens: 50 },
};
const context = { operationId: "operation-1", kind: "text" as const, stage: "course_generation", attempt: 1, requestedModel: "gpt-6-luna", startedAt: 1_000 };

beforeEach(() => vi.stubEnv("OPENAI_USAGE_LOG_FORMAT", "json"));
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllEnvs(); });

describe("generation usage measurements and input estimates", () => {
  it.each([
    ["gpt-6-luna", 0.001515], ["gpt-6-astra", 0.1515], ["gpt-6.1-sol", 0.0299],
  ])("prices disjoint reads and both write lifetimes for %s without double counting", (model, expected) => {
    const estimate = estimateGenerationInputCost(model, "default", readGenerationTokenUsage(measured));
    expect(estimate.usd).toBeCloseTo(expected, 10);
    expect(estimate).toMatchObject({ unavailableReason: null, pricingAsOf: "2026-11-27", assumedStandardTier: false, scope: "mainline_model_input_only" });
  });

  it("preserves missing counts as unknown and rejects invalid individual counts", () => {
    expect(readGenerationTokenUsage(null)).toEqual({ inputTokens: null, cachedInputTokens: null, cacheWriteTokens: null, cacheWrite30mTokens: null, cacheWrite12hTokens: null, outputTokens: null, reasoningTokens: null });
    const usage = readGenerationTokenUsage({ input_tokens: "12000", input_tokens_details: { cached_tokens: -1, cache_write_tokens: 0 }, output_tokens: 2.5 });
    expect(usage).toMatchObject({ inputTokens: null, cachedInputTokens: null, cacheWriteTokens: 0, outputTokens: null });
    expect(estimateGenerationInputCost("gpt-6-luna", null, usage)).toMatchObject({ usd: null, unavailableReason: "incomplete_usage" });
  });

  it("does not assume absent writes or an unreported write lifetime are zero", () => {
    for (const details of [{ cached_tokens: 0 }, { cached_tokens: 0, cache_write_tokens: 100 }]) {
      const usage = readGenerationTokenUsage({ input_tokens: 200, input_tokens_details: details });
      expect(estimateGenerationInputCost("gpt-6-luna", null, usage)).toMatchObject({ usd: null, unavailableReason: "incomplete_usage" });
    }
  });

  it("can price an explicitly reported zero write total without lifetime buckets", () => {
    const usage = readGenerationTokenUsage({ input_tokens: 2_000, input_tokens_details: { cached_tokens: 1_000, cache_write_tokens: 0 } });
    expect(usage.cacheWrite30mTokens).toBeNull();
    expect(estimateGenerationInputCost("gpt-6-luna", null, usage)).toMatchObject({ usd: 0.00011, assumedStandardTier: true });
  });

  it.each([
    { ...measured, input_tokens: 10_000 },
    { ...measured, input_tokens_details: { ...measured.input_tokens_details, cache_write_tokens: 6_999 } },
    { ...measured, input_tokens_details: { ...measured.input_tokens_details, cache_write_tokens: 2_000 } },
  ])("withholds a price when provider counts contradict each other", (value) => {
    expect(estimateGenerationInputCost("gpt-6-luna", "default", readGenerationTokenUsage(value))).toMatchObject({ usd: null, unavailableReason: "inconsistent_usage" });
  });

  it.each([[272_000, 0.0272], [272_001, 0.0544002]])("applies long-context pricing to the full %i-token request", (input, expected) => {
    const usage = readGenerationTokenUsage({ input_tokens: input, input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 } });
    expect(estimateGenerationInputCost("gpt-6-luna", "default", usage).usd).toBeCloseTo(expected, 10);
  });

  it("does not invent prices for other models, snapshots, or service tiers", () => {
    const usage = readGenerationTokenUsage(measured);
    for (const model of ["another-model", "gpt-6-luna-unverified-snapshot", "toString"])
      expect(estimateGenerationInputCost(model, "default", usage)).toMatchObject({ usd: null, unavailableReason: "unsupported_model" });
    expect(estimateGenerationInputCost("gpt-6-luna", "fast", usage)).toMatchObject({ usd: null, unavailableReason: "unsupported_service_tier" });
  });

  it("logs measured metadata and actual model pricing without echoing payloads", () => {
    vi.useFakeTimers(); vi.setSystemTime(1_050);
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    logGenerationUsage(context, { response: new Response(null, { headers: { "x-request-id": "req_1" } }), body: {
      id: "resp_1", model: "gpt-6-astra", service_tier: "default", status: "completed", usage: measured,
      prompt: "PRIVATE PROMPT", api_key: "PRIVATE KEY", output: [{ content: [{ text: "PRIVATE OUTPUT" }] }],
    } });
    const event = JSON.parse(log.mock.calls[0][0]);
    expect(event).toMatchObject({ event: "ai.generation.usage", operationId: "operation-1", stage: "course_generation", attempt: 1, durationMs: 50, requestId: "req_1", responseId: "resp_1", actualModel: "gpt-6-astra", providerStatus: "completed", usage: { inputTokens: 12_000, cachedInputTokens: 4_000, cacheWriteTokens: 7_000, outputTokens: 250, reasoningTokens: 50 } });
    expect(event.inputCostEstimate.usd).toBeCloseTo(0.1515, 10);
    expect(log.mock.calls[0][0]).not.toContain("PRIVATE");
  });

  it.each([
    [{ model: "invalid model" }, "unsupported_model"],
    [{ service_tier: "invalid tier" }, "unsupported_service_tier"],
  ])("withholds an estimate when reported pricing metadata is malformed", (metadata, reason) => {
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    logGenerationUsage(context, { response: new Response(), body: { usage: measured, ...metadata } });
    expect(JSON.parse(log.mock.calls[0][0]).inputCostEstimate).toMatchObject({ usd: null, unavailableReason: reason });
  });

  it("keeps optional image-tool measurements separate and leaves unreported cache reads unknown", () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    logGenerationUsage({ ...context, kind: "image", imageModel: "gpt-image-2.6-flare" }, { response: new Response(), body: {
      usage: measured, output: [{ type: "image_generation_call", result: "PRIVATE BASE64", usage: { input_tokens: 20, input_tokens_details: { text_tokens: 20, image_tokens: 0 }, output_tokens: 300 } }],
    } });
    const event = JSON.parse(log.mock.calls[0][0]);
    expect(event.imageCalls).toEqual([{ model: "gpt-image-2.6-flare", usage: { inputTokens: 20, cachedInputTokens: null, cacheWriteTokens: null, cacheWrite30mTokens: null, cacheWrite12hTokens: null, outputTokens: 300, reasoningTokens: null }, textInputTokens: 20, imageInputTokens: 0 }]);
    expect(event.inputCostEstimate.scope).toBe("mainline_model_input_only");
    expect(log.mock.calls[0][0]).not.toContain("PRIVATE");
  });
});
