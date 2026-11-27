import { afterEach, describe, expect, it, vi } from "vitest";
import { logGenerationProgress, logGenerationSummary, writeGenerationLog } from "@/lib/ai/generation/progress-log";

describe("course generation progress logs", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("writes a readable timestamp, task, state, progress, and job identifiers", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-16T08:15:30.000Z"));
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    logGenerationProgress({
      status: "IN PROGRESS",
      task: "Generate lesson content",
      courseId: "507f1f77bcf86cd799439011",
      jobId: "507f1f77bcf86cd799439012",
      current: 2,
      total: 5,
    });

    expect(log).toHaveBeenCalledWith(expect.stringMatching(/\[16 Nov 2026, 03:15:30 PM\] \[PROGRESS\] \[LESSON\] ▸ Generate lesson content \| status: IN PROGRESS \| lesson: 2\/5 \| course: 507f1f77\.\.\. \| job: 507f1f77\.\.\./));
  });

  it("prints explicit failure states without allowing multiline log injection", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    logGenerationProgress({ status: "FAILED", task: "Generate course draft", detail: "Provider failed\nretry required" });

    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toContain("✗ Generate course draft");
    expect(log.mock.calls[0][0]).toContain("status: FAILED");
    expect(log.mock.calls[0][0]).toContain("Provider failed retry required");
  });

  it("uses native ANSI colors for waiting states and supports plain-text output", () => {
    vi.stubEnv("LOG_COLORS", "always");
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    logGenerationProgress({ status: "WAITING", task: "Waiting for generation" });
    expect(log.mock.calls[0][0]).toContain("\u001b[33m…\u001b[0m");

    vi.stubEnv("LOG_COLORS", "never");
    writeGenerationLog("SUCCESS", "COURSE", "Course saved", {}, console.log);
    expect(log.mock.calls[1][0]).toContain("✓ Course saved");
    expect(log.mock.calls[1][0]).not.toContain("\u001b[");

    vi.stubEnv("LOG_COLORS", "auto");
    vi.stubEnv("NO_COLOR", "1");
    writeGenerationLog("INFO", "SYSTEM", "Plain text", {}, console.log);
    expect(log.mock.calls[2][0]).not.toContain("\u001b[");
  });

  it("suppresses duplicate progress and supports structured logs with full identifiers", () => {
    vi.stubEnv("LOG_FORMAT", "json");
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const event = {
      status: "IN PROGRESS" as const,
      task: "Generate lesson 1 of 1",
      courseId: "507f1f77bcf86cd799439011",
      sessionId: "507f1f77bcf86cd799439012",
      current: 1,
      total: 1,
    };

    logGenerationProgress(event);
    logGenerationProgress(event);

    expect(log).toHaveBeenCalledTimes(1);
    expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({
      event: "generation.log",
      category: "LESSON",
      courseId: event.courseId,
      sessionId: event.sessionId,
      level: "PROGRESS",
    });
    expect(JSON.parse(log.mock.calls[0][0]).at).toMatch(/^\d{4}-\d\d-\d\dT.*Z$/);
  });

  it("keeps errors visible when informational messages are filtered", () => {
    vi.stubEnv("LOG_LEVEL", "error");
    vi.stubEnv("LOG_FORMAT", "json");
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    logGenerationProgress({ status: "IN PROGRESS", task: "Prepare lesson" });
    logGenerationProgress({ status: "FAILED", task: "Prepare lesson" });

    expect(log).toHaveBeenCalledTimes(1);
    expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({ level: "ERROR", status: "FAILED" });
  });

  it("prints multiline summaries and keeps unavailable measurements distinct from zero", () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    logGenerationSummary({
      courseTitle: "Example course",
      courseId: "507f1f77bcf86cd799439011",
      totalLessons: 2,
      generatedImages: 0,
      totalAiRequests: 1,
      inputTokens: null,
      cachedInputTokens: null,
      uncachedInputTokens: null,
      outputTokens: null,
      reasoningTokens: 20,
      cacheWriteTokens: 1_000,
      imageTokens: null,
      imageTextInputTokens: null,
      cachedImageTextInputTokens: null,
      imageInputTokens: null,
      cachedImageInputTokens: null,
      imageTextOutputTokens: null,
      imageOutputTokens: null,
      imageTotalTokens: null,
      recordedTextTokens: null,
      recordedImageTokens: null,
      totalTokens: null,
      usageCompleteness: "unavailable",
      cacheHitPercent: null,
      imageCacheHitPercent: null,
      estimatedCacheSavingsUsd: null,
      textGenerationCostUsd: null,
      imageGenerationCostUsd: null,
      imageGenerationCostStatus: "unavailable",
      combinedGenerationCostUsd: null,
      failedRequests: 0,
      retries: 0,
      activeProcessingMs: 65_000,
      userWaitingMs: null,
      totalElapsedMs: 2_000,
      finalStatus: "FAILED",
    });

    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toContain("\n  COURSE\n");
    expect(log.mock.calls[0][0]).toMatch(/Title\s+Example course/);
    expect(log.mock.calls[0][0]).toContain("\n  TOKEN USAGE\n");
    expect(log.mock.calls[0][0]).toContain("Input Tokens");
    expect(log.mock.calls[0][0]).toMatch(/Cache Write Tokens\s+1,000/);
    expect(log.mock.calls[0][0]).toMatch(/Reasoning Tokens\s+20/);
    expect(log.mock.calls[0][0]).toContain("User Waiting");
    expect(log.mock.calls[0][0]).toContain("Unavailable");
    expect(log.mock.calls[0][0]).toContain("1m 05s");
    expect(log.mock.calls[0][0]).toContain("  ────────────────────────────────────────────────\n");
    expect(log.mock.calls[0][0]).not.toContain("text $0.00000000");
  });

  it("redacts credentials from detail text", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    logGenerationProgress({ status: "FAILED", task: "Provider request failed", detail: "Authorization: Bearer sk-12345678901234567890" });

    expect(log.mock.calls[0][0]).not.toContain("sk-12345678901234567890");
    expect(log.mock.calls[0][0]).toContain("[REDACTED]");
  });
});
