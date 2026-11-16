import { afterEach, describe, expect, it, vi } from "vitest";
import { logGenerationProgress } from "@/lib/ai/generation/progress-log";

describe("course generation progress logs", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
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

    expect(log).toHaveBeenCalledWith(expect.stringMatching(/\[Nov 16, 2026, 8:15:30 AM UTC\] \[COURSE GENERATION\] \[IN PROGRESS\] \[Generate lesson content\] \[Progress: 2\/5\] \[Course: 507f1f77bcf86cd799439011\] \[Job: 507f1f77bcf86cd799439012\]/));
  });

  it("prints explicit failure states without allowing multiline log injection", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    logGenerationProgress({ status: "FAILED", task: "Generate course draft", detail: "Provider failed\nretry required" });

    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toContain("[FAILED]");
    expect(log.mock.calls[0][0]).toContain("Provider failed retry required");
  });
});
