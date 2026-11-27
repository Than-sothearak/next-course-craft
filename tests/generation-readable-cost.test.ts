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
  it("formats compact text costs and token usage without billing reasoning twice", () => {
    vi.stubEnv("OPENAI_USAGE_LOG_FORMAT", "readable");
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    logGenerationUsage({ ...context, courseId }, { response: new Response(), body });
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toContain("[COST] [AI COST] ◆ Text request");
    expect(log.mock.calls[0][0]).toContain("Text request (HTTP 200/completed)");
    expect(log.mock.calls[0][0]).toContain("Model      gpt-6-luna");
    expect(log.mock.calls[0][0]).toMatch(/input 453 · uncached 453 · output 440 · total 893 · reasoning \(included\) 200/);
    expect(log.mock.calls[0][0]).toContain("total 893");
    expect(log.mock.calls[0][0]).toMatch(/ESTIMATED COST\s+Text \$0\.00026530 · Combined \$0\.00026530/);
    expect(log.mock.calls[0][0].split("\n")).toHaveLength(7);
    expect(log.mock.calls[0][0]).not.toContain("COST (ESTIMATED)");
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

  it("keeps request identifiers out of normal logs but preserves them in DEBUG and JSON", () => {
    vi.stubEnv("OPENAI_USAGE_LOG_FORMAT", "readable");
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const response = new Response(null, { headers: { "x-request-id": "req_sensitive_detail" } });

    logGenerationUsage({ ...context, courseId }, { response, body });
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).not.toContain("req_sensitive_detail");

    vi.stubEnv("LOG_LEVEL", "debug");
    logGenerationUsage({ ...context, courseId }, { response, body });
    expect(log.mock.calls).toHaveLength(3);
    expect(log.mock.calls[2][0]).toContain("req_sensitive_detail");
    expect(log.mock.calls[2][0]).toContain("Operation Id");

    vi.stubEnv("LOG_FORMAT", "json");
    logGenerationUsage({ ...context, courseId }, { response, body });
    const structured = JSON.parse(log.mock.calls[3][0]);
    expect(structured).toMatchObject({ operationId: context.operationId, requestId: "req_sensitive_detail", courseId });
  });

  it("supports both formats and keeps image costs unavailable when tool usage is absent", () => {
    vi.stubEnv("OPENAI_USAGE_LOG_FORMAT", "both");
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    logGenerationUsage({ ...context, kind: "image", imageModel: "gpt-image-2.6-flare", courseId }, { response: new Response(), body });
    expect(log).toHaveBeenCalledTimes(2);
    expect(JSON.parse(log.mock.calls[0][0]).textCostEstimate.usd).toBeCloseTo(0.0002653, 10);
    expect(JSON.parse(log.mock.calls[0][0]).imageCostEstimate).toMatchObject({ usd: null, status: "unavailable", unavailableReason: "incomplete_usage" });
    expect(log.mock.calls[1][0]).toMatch(/Image Unavailable · Combined Unavailable · image Unavailable/);
  });

  it("shows image usage splits and separately prices the image model", () => {
    vi.stubEnv("OPENAI_USAGE_LOG_FORMAT", "readable");
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const imageBody = {
      ...body,
      output: [{
        type: "image_generation_call",
        status: "completed",
        result: "PRIVATE BASE64",
      }],
      tool_usage: { image_gen: {
          input_tokens: 22,
          input_tokens_details: { text_tokens: 7, image_tokens: 15 },
          cached_tokens: 0,
          cached_tokens_details: { cached_text_tokens: 0, cached_image_tokens: 0 },
          output_tokens: 31,
          output_tokens_details: { text_tokens: 0, image_tokens: 31 },
          total_tokens: 53,
      } },
    };

    logGenerationUsage({ ...context, kind: "image", imageModel: "gpt-image-2.6-flare", courseId }, { response: new Response(), body: imageBody });

    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toMatch(/Image text input 7/);
    expect(log.mock.calls[0][0]).toMatch(/Image\s+input 15 · output 31/);
    expect(log.mock.calls[0][0]).toContain("Total      946 recorded");
    expect(log.mock.calls[0][0]).toContain("image calculated");
    expect(log.mock.calls[0][0]).not.toContain("PRIVATE");
    expect(log.mock.calls[0][0].split("\n").length).toBeLessThanOrEqual(12);
  });

  it("does not present unavailable usage or unsupported pricing as a free generation", () => {
    vi.stubEnv("OPENAI_USAGE_LOG_FORMAT", "readable");
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    logGenerationUsage(context, {});
    expect(log.mock.calls[0][0]).toMatch(/Text Unavailable/);
    expect(log.mock.calls[0][0]).toMatch(/input Unavailable/);
    expect(log.mock.calls[0][0]).toMatch(/output Unavailable/);
    expect(log.mock.calls[0][0]).not.toContain("$0.00000000");
  });
});
