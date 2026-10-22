import { EventEmitter } from "node:events";
import type { IncomingMessage } from "node:http";
import { request, type RequestOptions } from "node:https";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requestGenerationResponse } from "../lib/ai/generation/transport";
import { providerConnectionError, requestStructuredJson } from "../lib/ai/generation/provider";
import { generationStageTimeoutMs } from "../lib/ai/generation-timeouts";

vi.mock("node:https", async (original) => ({ ...await original<typeof import("node:https")>(), request: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  // Drive AbortSignal's deadline with the same virtual clock as the mock socket.
  vi.spyOn(AbortSignal, "timeout").mockImplementation((milliseconds) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(new DOMException("Deadline exceeded", "TimeoutError")), milliseconds);
    return controller.signal;
  });
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

function mockResponse({ headerDelay = 0, bodyDelay = 0, status = 200, payload = JSON.stringify({ output_text: JSON.stringify({ title: "Complete course" }) }), headers = {} }: {
  headerDelay?: number; bodyDelay?: number; status?: number; payload?: string; headers?: Record<string, string>;
} = {}) {
  vi.mocked(request).mockImplementation(((_url: string, options: RequestOptions, callback: (response: IncomingMessage) => void) => {
    const outgoing = Object.assign(new EventEmitter(), { end: vi.fn(), destroy: vi.fn() });
    const incoming = Object.assign(new PassThrough(), { statusCode: status, headers });
    const onAbort = () => outgoing.emit("error", new Error("The request was aborted.", { cause: options.signal?.reason }));
    options.signal?.addEventListener("abort", onAbort, { once: true });
    incoming.once("close", () => options.signal?.removeEventListener("abort", onAbort));
    outgoing.destroy.mockImplementation((error: Error) => {
      outgoing.emit("error", error);
      incoming.destroy();
      return outgoing;
    });
    outgoing.end.mockImplementation(() => {
      setTimeout(() => {
        callback(incoming as unknown as IncomingMessage);
        if (bodyDelay) setTimeout(() => incoming.end(payload), bodyDelay);
        else incoming.end(payload);
      }, headerDelay);
    });
    return outgoing;
  }) as never);
}

function generate() {
  return requestStructuredJson({
    model: "test-model", developerPrompt: "Create a course.", content: [],
    schemaName: "test_course", schema: {}, maxOutputTokens: 1_000,
    timeoutMs: generationStageTimeoutMs,
  });
}

describe("ten-minute generation transport", () => {
  it("continues waiting for headers after the old five-minute HTTP timeout", async () => {
    mockResponse({ headerDelay: 360_000 });
    const pending = generate();
    await vi.advanceTimersByTimeAsync(360_000);
    await expect(pending).resolves.toEqual({ title: "Complete course" });
    const options = vi.mocked(request).mock.calls[0][1] as RequestOptions;
    expect(options.timeout).toBe(0);
    expect(options.signal?.aborted).toBe(false);
    expect(AbortSignal.timeout).toHaveBeenCalledWith(600_000);
  });

  it("allows a slow response body to finish within the same ten-minute deadline", async () => {
    mockResponse({ bodyDelay: 540_000 });
    const pending = generate();
    await vi.advanceTimersByTimeAsync(540_000);
    await expect(pending).resolves.toEqual({ title: "Complete course" });
  });

  it.each([{ headerDelay: 660_000 }, { bodyDelay: 660_000 }])("aborts at ten minutes without submitting another expensive generation: %j", async (delay) => {
    mockResponse(delay);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const pending = expect(generate()).rejects.toMatchObject({ status: 504 });
    await vi.advanceTimersByTimeAsync(600_000);
    await pending;
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("preserves error status and Retry-After headers for the existing retry policy", async () => {
    mockResponse({ status: 429, payload: JSON.stringify({ error: { code: "rate_limit_exceeded" } }), headers: { "retry-after": "2" } });
    const pending = requestGenerationResponse("test-key", "{}", AbortSignal.timeout(600_000));
    await vi.advanceTimersByTimeAsync(0);
    const response = await pending;
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("2");
    expect(await response.json()).toEqual({ error: { code: "rate_limit_exceeded" } });
  });

  it("bounds the response size while waiting for large generated content", async () => {
    mockResponse({ payload: "x".repeat(16 * 1024 * 1024 + 1) });
    const pending = expect(requestGenerationResponse("test-key", "{}", AbortSignal.timeout(600_000))).rejects.toThrow("size limit");
    await vi.advanceTimersByTimeAsync(0);
    await pending;
  });

  it("keeps timeout and blocked-network diagnostics for native HTTPS errors", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(providerConnectionError(Object.assign(new Error("Timed out"), { code: "ETIMEDOUT" }), "AI provider")).toMatchObject({ status: 504 });
    expect(providerConnectionError(Object.assign(new Error("Blocked"), { code: "EACCES" }), "AI provider").message).toContain("blocked from making outbound HTTPS requests");
  });
});
