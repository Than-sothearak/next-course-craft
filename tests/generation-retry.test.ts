import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createGenerationBudget,
  GenerationProviderError,
  generationRetryDelay,
  providerRetryAfterMs,
} from "../lib/ai/generation-retry";

afterEach(() => vi.restoreAllMocks());

describe("generation retry limits", () => {
  it("reads Retry-After seconds and HTTP dates", () => {
    const now = Date.parse("2026-10-15T00:00:00Z");
    expect(providerRetryAfterMs(new Headers({ "retry-after": "2.5" }), now)).toBe(2_500);
    expect(providerRetryAfterMs(new Headers({ "retry-after": "Thu, 15 Oct 2026 00:00:03 GMT" }), now)).toBe(3_000);
    expect(providerRetryAfterMs(new Headers({ "retry-after": "invalid" }), now)).toBe(0);
  });

  it("waits at least the provider delay with bounded jitter", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const budget = createGenerationBudget(60_000);
    budget.remainingAttempts -= 1;
    expect(generationRetryDelay(new GenerationProviderError("Busy", 429, true, 2_000), budget)).toBe(2_125);
  });

  it("stops when attempts, the deadline, or the allowed wait are exhausted", () => {
    const busy = new GenerationProviderError("Busy", 503, true);
    expect(generationRetryDelay(busy, { deadline: Date.now() + 60_000, remainingAttempts: 0 })).toBeNull();
    expect(generationRetryDelay(busy, createGenerationBudget(500))).toBeNull();
    expect(generationRetryDelay(new GenerationProviderError("Busy", 429, true, 60_000), createGenerationBudget(120_000))).toBeNull();
  });

  it("retries temporary connection failures but not timeouts or blocked access", () => {
    const connection = (code: string) => new TypeError("fetch failed", { cause: { code } });
    expect(generationRetryDelay(connection("ECONNRESET"), createGenerationBudget(60_000))).toBeGreaterThanOrEqual(750);
    expect(generationRetryDelay(connection("EACCES"), createGenerationBudget(60_000))).toBeNull();
    expect(generationRetryDelay(new DOMException("Too slow", "TimeoutError"), createGenerationBudget(60_000))).toBeNull();
    expect(generationRetryDelay(new GenerationProviderError("Quota", 503, false), createGenerationBudget(60_000))).toBeNull();
  });
});
