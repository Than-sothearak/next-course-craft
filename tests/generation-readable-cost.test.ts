import { afterEach, describe, expect, it, vi } from "vitest";
import { logGenerationUsage } from "@/lib/ai/generation/usage";
import { withCourseUsage } from "@/lib/ai/generation/usage-scope";

const courseId = "6b086ad67a8a08b48cf779d9";
const context = { operationId: "test-operation", kind: "text" as const, stage: "course_outline", attempt: 1, requestedModel: "gpt-6-luna", startedAt: Date.now() };
const body = {
  model: "gpt-6-luna", service_tier: "default", status: "completed",
  usage: { input_tokens: 453, input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0, cache_write_tokens_details: { ttl_30m_tokens: 0, ttl_12h_tokens: 0 } }, output_tokens: 440, output_tokens_details: { reasoning_tokens: 200 } },
};
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe("readable course cost logs", () => {
  it("formats the supplied outline cost with input and output, without billing reasoning twice", () => {
    vi.stubEnv("OPENAI_USAGE_LOG_FORMAT", "readable");
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    logGenerationUsage({ ...context, courseId }, { response: new Response(), body });
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toContain(`[COURSE COST] [Course: ${courseId}] [course outline]`);
    expect(log.mock.calls[0][0]).toContain("Estimated text total: $0.00026530");
    expect(log.mock.calls[0][0]).toContain("Input: $0.00004530 | Output: $0.00022000");
    expect(log.mock.calls[0][0]).toContain("Tokens: 453 in / 440 out");
    expect(log.mock.calls[0][0]).not.toContain("schemaHash");
  });

  it("keeps concurrent course scopes isolated and restores the caller's scope", async () => {
    vi.stubEnv("OPENAI_USAGE_LOG_FORMAT", "json");
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const run = withCourseUsage(async (scope: { courseId: string }, wait: boolean) => {
      if (wait) await new Promise<void>((resolve) => setTimeout(resolve, 5));
      logGenerationUsage(context, { response: new Response(), body });
      return scope.courseId;
    });
    await Promise.all([run({ courseId: "course-a" }, true), run({ courseId: "course-b" }, false)]);
    logGenerationUsage(context, { response: new Response(), body });
    expect(log.mock.calls.map(([line]) => JSON.parse(line).courseId)).toEqual(["course-b", "course-a", null]);
  });

  it("supports both formats and marks image charges as excluded", () => {
    vi.stubEnv("OPENAI_USAGE_LOG_FORMAT", "both");
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    logGenerationUsage({ ...context, kind: "image", courseId }, { response: new Response(), body });
    expect(log).toHaveBeenCalledTimes(2);
    expect(JSON.parse(log.mock.calls[0][0]).textCostEstimate.usd).toBeCloseTo(0.0002653, 10);
    expect(log.mock.calls[1][0]).toContain("Estimated text subtotal:");
    expect(log.mock.calls[1][0]).toContain("Image charges excluded");
  });

  it("does not present unavailable usage or unsupported pricing as a free generation", () => {
    vi.stubEnv("OPENAI_USAGE_LOG_FORMAT", "readable");
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    logGenerationUsage(context, {});
    expect(log.mock.calls[0][0]).toContain("Estimated text total: unknown");
    expect(log.mock.calls[0][0]).toContain("Tokens: unknown in / unknown out");
  });
});
