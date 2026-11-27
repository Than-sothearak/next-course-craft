import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createUsageReport, formatUsageReport } from "@/lib/ai/generation/usage-report";

function event(overrides: Record<string, unknown> = {}) {
  return {
    event: "ai.generation.usage", version: 1, operationId: "op-1", attempt: 1,
    at: "2026-11-27T00:00:00.000Z", actualModel: "gpt-6-luna", requestedModel: "gpt-6-luna",
    kind: "text", stage: "course_generation", cachePolicy: "shared_developer_v1", serviceTier: "default",
    schemaHash: "a".repeat(64), developerPromptHash: "b".repeat(64),
    outcome: "response_received", httpStatus: 200, providerStatus: "completed", durationMs: 200,
    usage: { inputTokens: 1_000, cachedInputTokens: 100, cacheWriteTokens: 700, cacheWrite30mTokens: 300, cacheWrite12hTokens: 400, outputTokens: 50, reasoningTokens: 10 },
    // Synthetic stored estimates test aggregation, not live pricing or savings.
    inputCostEstimate: { usd: 0.1, scope: "mainline_model_input_only", pricingAsOf: "2026-11-27", assumedStandardTier: false },
    ...overrides,
  };
}

function summarize(values: unknown[]) {
  const report = createUsageReport();
  for (const value of values) report.addLine(JSON.stringify(value));
  return report.result();
}

function pricedEvent(courseId: string, operationId: string, inputUsd: number, outputUsd: number, overrides: Record<string, unknown> = {}) {
  return event({ courseId, operationId,
    inputCostEstimate: { ...event().inputCostEstimate, usd: inputUsd },
    textCostEstimate: { inputUsd, outputUsd, usd: inputUsd + outputUsd, scope: "mainline_model_text_only", pricingAsOf: "2026-11-27" },
    ...overrides,
  });
}

describe("offline generation usage report", () => {
  it("combines outline, lessons and retries into a course text total without duplicate charges", () => {
    const outline = pricedEvent("course-a", "outline", 0.01, 0.02, { stage: "course_outline" });
    const lesson = pricedEvent("course-a", "lesson", 0.02, 0.03);
    const retry = pricedEvent("course-a", "lesson", 0.03, 0.04, { attempt: 2 });
    const report = summarize([outline, lesson, retry, retry]);
    expect(report.courses).toHaveLength(1);
    const course = report.courses[0];
    expect(course.courseId).toBe("course-a");
    expect(course.totals).toMatchObject({ events: 3, retryAttempts: 1, estimatedInputCost: { knownEvents: 3, missingEvents: 0 }, estimatedOutputCost: { knownEvents: 3 }, estimatedTextCost: { knownEvents: 3, missingEvents: 0 } });
    expect(course.totals.estimatedInputCost.usd).toBeCloseTo(0.06);
    expect(course.totals.estimatedOutputCost.usd).toBeCloseTo(0.09);
    expect(course.totals.estimatedTextCost.usd).toBeCloseTo(0.15);
    expect(formatUsageReport(report)).toContain("Course: course-a");
    expect(formatUsageReport(report)).toContain("$0.15000000 (3/3 attempts priced)");
  });

  it("keeps separate courses and legacy unassigned attempts separate", () => {
    const report = summarize([pricedEvent("course-a", "a", 0.01, 0.02), pricedEvent("course-b", "b", 0.1, 0.2), event({ operationId: "legacy" })]);
    expect(report.courses).toHaveLength(3);
    expect(report.courses.find((course) => course.courseId === "course-a")?.totals.estimatedTextCost.usd).toBeCloseTo(0.03);
    expect(report.courses.find((course) => course.courseId === "course-b")?.totals.estimatedTextCost.usd).toBeCloseTo(0.3);
    expect(report.courses.find((course) => course.courseId === null)?.totals.estimatedOutputCost.usd).toBeNull();
    expect(formatUsageReport(report)).toContain("unknown (no course ID in logs)");
  });

  it("labels partial cost coverage and retains known zero-cost output", () => {
    const report = summarize([
      pricedEvent("course-a", "priced", 0.01, 0),
      event({ courseId: "course-a", operationId: "legacy" }),
      event({ courseId: "course-a", operationId: "failure", outcome: "transport_error", usage: null, inputCostEstimate: null }),
    ]);
    expect(report.courses[0].totals.estimatedOutputCost).toEqual({ usd: 0, knownEvents: 1, missingEvents: 2 });
    expect(report.courses[0].totals.estimatedTextCost).toEqual({ usd: 0.01, knownEvents: 1, missingEvents: 2 });
    expect(formatUsageReport(report)).toContain("$0.01000000 (1/3 attempts priced; partial coverage)");
  });

  it("excludes inconsistent cost components while retaining valid input estimates", () => {
    const report = summarize([pricedEvent("course-a", "bad", 0.01, 0.02, {
      textCostEstimate: { inputUsd: 0.01, outputUsd: 0.02, usd: 10, scope: "mainline_model_text_only", pricingAsOf: "2026-11-27" },
    })]);
    expect(report.totals).toMatchObject({ inconsistentCostEvents: 1, estimatedInputCost: { usd: 0.01 }, estimatedOutputCost: { usd: null, missingEvents: 1 }, estimatedTextCost: { usd: null, missingEvents: 1 } });
  });

  it("keeps image charges unavailable for legacy records without image-tool usage", () => {
    const report = summarize([pricedEvent("course-a", "image", 0.01, 0.02, { kind: "image", imageCalls: [{ usd: 100 }] })]);
    expect(report.courses[0].totals.imageRequests).toBe(1);
    expect(report.courses[0].totals.estimatedTextCost.usd).toBeCloseTo(0.03);
    expect(report.courses[0].totals.estimatedImageCost).toMatchObject({ usd: null, knownEvents: 0, missingEvents: 1 });
    expect(formatUsageReport(report)).toContain("Estimated image-generation cost: unknown (0/1 attempts priced; partial coverage)");
  });

  it("aggregates image tokens and calculated image cost separately from orchestration cost", () => {
    const report = summarize([pricedEvent("course-a", "image", 0.01, 0.02, {
      kind: "image",
      imageUsage: {
        inputTokens: 20, textInputTokens: 7, imageInputTokens: 13,
        cachedInputTokens: 0, cachedTextInputTokens: 0, cachedImageInputTokens: 0,
        outputTokens: 31, textOutputTokens: 0, imageOutputTokens: 31, totalTokens: 51,
      },
      imageCostEstimate: {
        usd: 0.001069, status: "calculated", unavailableReason: null,
        pricingAsOf: "2026-11-27", cacheAssumption: null,
      },
    })]);
    expect(report.courses[0].totals.imageTokens).toMatchObject({
      textInputTokens: { sum: 7 }, imageInputTokens: { sum: 13 }, imageOutputTokens: { sum: 31 }, totalTokens: { sum: 51 },
    });
    expect(report.courses[0].totals.estimatedTextCost.usd).toBeCloseTo(0.03);
    expect(report.courses[0].totals.estimatedImageCost).toMatchObject({ usd: 0.001069, calculatedEvents: 1, estimatedEvents: 0 });
    expect(report.courses[0].totals.estimatedCombinedCost.usd).toBeCloseTo(0.031069);
    expect(formatUsageReport(report)).toContain("Estimated image-generation cost: $0.00106900 (1/1 attempts priced)");
  });

  it("calculates a token-weighted read rate, sums disjoint writes and counts retries", () => {
    const report = summarize([event(), event({ attempt: 2, durationMs: 400, usage: { inputTokens: 9_000, cachedInputTokens: 8_100, cacheWriteTokens: 0 }, inputCostEstimate: { ...event().inputCostEstimate, usd: 0.02 } })]);
    expect(report.identifiedOperations).toBe(1);
    expect(report.totals).toMatchObject({ events: 2, retryAttempts: 1, cacheReadRate: { ratio: 0.82, pairedEvents: 2, inputTokens: 10_000, cachedTokens: 8_200 }, tokens: { cacheWriteTokens: { sum: 700 }, cacheWrite30mTokens: { sum: 300, knownEvents: 1, missingEvents: 1 } }, duration: { meanMs: 300 } });
    expect(report.totals.estimatedInputCost.usd).toBeCloseTo(0.12);
  });

  it("retains failed attempts without inventing usage or zero-dollar costs", () => {
    const report = summarize([event({ outcome: "transport_error", httpStatus: null, usage: null, inputCostEstimate: null }), event({ attempt: 2, httpStatus: 429, providerStatus: "failed", usage: {}, inputCostEstimate: null })]);
    expect(report.totals).toMatchObject({ events: 2, retryAttempts: 1, observedProviderFailures: 2, tokens: { inputTokens: { sum: null, knownEvents: 0, missingEvents: 2 } }, cacheReadRate: { ratio: null, excludedEvents: 2 }, estimatedInputCost: { usd: null, knownEvents: 0, missingEvents: 2 } });
    expect(formatUsageReport(report)).toContain("Estimated input USD: unknown");
  });

  it("counts measured zero separately from missing data and excludes unknowns from rate denominators", () => {
    const report = summarize([event({ usage: { inputTokens: 100, cachedInputTokens: null }, inputCostEstimate: null }), event({ attempt: 2, usage: { inputTokens: 0, cachedInputTokens: 0, cacheWriteTokens: 0 }, inputCostEstimate: { ...event().inputCostEstimate, usd: 0 } })]);
    expect(report.totals.cacheReadRate).toMatchObject({ ratio: null, pairedEvents: 1, excludedEvents: 1, inputTokens: 0 });
    expect(report.totals.estimatedInputCost).toEqual({ usd: 0, knownEvents: 1, missingEvents: 1 });
  });

  it("excludes invalid or contradictory counters and invalid estimates", () => {
    const report = summarize([event({ usage: { inputTokens: 100, cachedInputTokens: 200 } }), event({ attempt: 2, usage: { inputTokens: -10, cachedInputTokens: "5" }, inputCostEstimate: { ...event().inputCostEstimate, usd: -1 } })]);
    expect(report.totals).toMatchObject({ inconsistentUsageEvents: 1, cacheReadRate: { ratio: null, excludedEvents: 2 }, estimatedInputCost: { usd: null, missingEvents: 2 } });
  });

  it("deduplicates replayed events across files and flags conflicting duplicates", () => {
    const report = summarize([event(), event(), event({ usage: { inputTokens: 500 } })]);
    expect(report.totals.events).toBe(1);
    expect(report.ingestion).toMatchObject({ duplicateEvents: 2, conflictingDuplicateEvents: 1 });
  });

  it("separates models, policies, schema families, days, and image attempts", () => {
    const report = summarize([
      event(), event({ operationId: "op-2", cachePolicy: "provider_default" }),
      event({ operationId: "op-3", actualModel: "gpt-6-astra" }),
      event({ operationId: "op-4", schemaHash: "c".repeat(64) }),
      event({ operationId: "op-5", at: "2026-11-28T00:00:00.000Z" }),
      event({ operationId: "op-6", kind: "image", cachePolicy: null, imageCalls: [{ usage: { inputTokens: 999_999 } }] }),
    ]);
    expect(report.groups).toHaveLength(6);
    expect(report.totals.tokens.inputTokens.sum).toBe(6_000);
  });

  it("handles mixed stdout and invalid events without echoing private content", () => {
    const report = createUsageReport();
    report.addLine("PRIVATE log text");
    report.addLine('{"event":"other","secret":"PRIVATE"}');
    report.addLine('{"event":"ai.generation.usage",INVALID PRIVATE');
    report.addLine(JSON.stringify(event({ version: 2 })));
    report.addLine("[server] " + JSON.stringify(event({ prompt: "PRIVATE PROMPT", output: "PRIVATE OUTPUT" })));
    const result = report.result();
    expect(result.ingestion).toMatchObject({ ignoredLines: 2, invalidEvents: 2 });
    expect(result.totals.events).toBe(1);
    expect(formatUsageReport(result)).not.toContain("PRIVATE");
    expect(JSON.stringify(result)).not.toContain("PRIVATE");
  });

  it("reports no measurements when the input contains no usage events", () => {
    const result = summarize([]);
    expect(result.totals.estimatedInputCost.usd).toBeNull();
    expect(result.totals.cacheReadRate.ratio).toBeNull();
    expect(result.groups).toEqual([]);
  });

  it("runs the CLI offline through stdin and produces machine-readable JSON", () => {
    const script = fileURLToPath(new URL("../scripts/report-ai-usage.mjs", import.meta.url));
    const child = spawnSync(process.execPath, [script, "--json"], { input: JSON.stringify(event()) + "\n", encoding: "utf8", windowsHide: true });
    expect(child.status, child.stderr).toBe(0);
    expect(JSON.parse(child.stdout).totals.events).toBe(1);
    const invalid = spawnSync(process.execPath, [script, "--unknown"], { encoding: "utf8", windowsHide: true });
    expect(invalid.status).toBe(1);
  });

  it("reads multiple existing files, deduplicates their overlap, and fails for missing input", () => {
    const directory = mkdtempSync(join(tmpdir(), "coursecraft-usage-report-"));
    const first = join(directory, "first.log"), second = join(directory, "second.log");
    const script = fileURLToPath(new URL("../scripts/report-ai-usage.mjs", import.meta.url));
    try {
      writeFileSync(first, JSON.stringify(event()) + "\n");
      writeFileSync(second, JSON.stringify(event()) + "\n" + JSON.stringify(event({ attempt: 2 })) + "\n");
      const result = spawnSync(process.execPath, [script, "--json", first, second], { encoding: "utf8", windowsHide: true });
      expect(result.status, result.stderr).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({ ingestion: { duplicateEvents: 1 }, totals: { events: 2, retryAttempts: 1 } });
      const missing = spawnSync(process.execPath, [script, join(directory, "missing.log")], { encoding: "utf8", windowsHide: true });
      expect(missing.status).toBe(1);
      expect(missing.stdout).toBe("");
    } finally {
      unlinkSync(first); unlinkSync(second); rmdirSync(directory);
    }
  });
});
