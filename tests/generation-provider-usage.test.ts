import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requestStructuredJson } from "@/lib/ai/generation/provider";
import { requestGenerationResponse } from "@/lib/ai/generation/transport";

vi.mock("@/lib/ai/generation/transport", () => ({ requestGenerationResponse: vi.fn() }));
const transport = vi.mocked(requestGenerationResponse);
const measured = { input_tokens: 2_000, input_tokens_details: { cached_tokens: 1_000, cache_write_tokens: 0 }, output_tokens: 30 };
const request = () => requestStructuredJson({ model: "gpt-6-luna", developerPrompt: "PRIVATE PROMPT", content: [{ type: "input_text", text: "PRIVATE SOURCE" }], schemaName: "test_course", schema: { type: "object" }, maxOutputTokens: 100, timeoutMs: 60_000 });
const response = (body: object, status = 200) => new Response(JSON.stringify({ model: "gpt-6-luna", service_tier: "default", usage: measured, ...body }), { status, headers: { "x-request-id": "req_test" } });
const events = () => vi.mocked(console.info).mock.calls.map(([line]) => JSON.parse(line));

beforeEach(() => {
  transport.mockReset();
  vi.stubEnv("OPENAI_API_KEY", "PRIVATE API KEY");
  vi.stubEnv("OPENAI_USAGE_LOG_FORMAT", "json");
  vi.stubEnv("OPENAI_PROMPT_CACHE_MODE", "explicit");
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("provider usage tracking", () => {
  it.each(["gpt-6-luna", "gpt-6-astra", "gpt-6.1-sol"])("uses explicit caching for verified model %s", async (model) => {
    transport.mockResolvedValueOnce(response({ output_text: "{}" }));
    await requestStructuredJson({ model, developerPrompt: "Reusable instructions", content: [], schemaName: "test_course", schema: {}, maxOutputTokens: 100, timeoutMs: 60_000 });
    expect(JSON.parse(transport.mock.calls[0][1]).prompt_cache_options).toEqual({ mode: "explicit", ttl: "30m" });
  });

  it.each(["gpt-5", "gpt-6-unknown", "gpt-6-luna-unverified-snapshot"])("omits unsupported caching parameters for %s", async (model) => {
    transport.mockResolvedValueOnce(response({ output_text: "{}" }));
    await requestStructuredJson({ model, developerPrompt: "Reusable instructions", content: [], schemaName: "test_course", schema: {}, maxOutputTokens: 100, timeoutMs: 60_000 });
    const body = JSON.parse(transport.mock.calls[0][1]);
    expect(body.prompt_cache_options).toBeUndefined();
    expect(body.input[0].content).toBe("Reusable instructions");
    expect(events()[0].cachePolicy).toBe("provider_default");
  });

  it("can restore provider-default caching for baseline comparison", async () => {
    vi.stubEnv("OPENAI_PROMPT_CACHE_MODE", "provider_default");
    transport.mockResolvedValueOnce(response({ output_text: "{}" }));
    await request();
    const body = JSON.parse(transport.mock.calls[0][1]);
    expect(body.prompt_cache_options).toBeUndefined();
    expect(body.input[0].content).toBe("PRIVATE PROMPT");
    expect(events()[0].cachePolicy).toBe("provider_default");
  });

  it("rejects a misspelled cache policy before sending any provider request", async () => {
    vi.stubEnv("OPENAI_PROMPT_CACHE_MODE", "explict");
    await expect(request()).rejects.toMatchObject({ status: 503 });
    expect(transport).not.toHaveBeenCalled();
  });

  it("keeps the developer boundary and schema identical when lesson inputs change", async () => {
    transport.mockImplementation(async () => response({ output_text: "{}" }));
    for (const lesson of ["First lesson", "Second lesson"]) {
      await requestStructuredJson({ model: "gpt-6-luna", developerPrompt: "Shared teaching guidance", content: [{ type: "input_text", text: lesson }], schemaName: "test_course", schema: { type: "object" }, maxOutputTokens: 100, timeoutMs: 60_000 });
    }
    const first = JSON.parse(transport.mock.calls[0][1]);
    const second = JSON.parse(transport.mock.calls[1][1]);
    expect(first.input[0]).toEqual(second.input[0]);
    expect(first.text.format).toEqual(second.text.format);
    expect(first.input[1]).not.toEqual(second.input[1]);
    expect(events()[0].developerPromptHash).toBe(events()[1].developerPromptHash);
  });

  it("records usage and caches only the shared developer instructions", async () => {
    transport.mockResolvedValueOnce(response({ id: "resp_test", status: "completed", output_text: '{"title":"Course"}' }));
    await expect(request()).resolves.toEqual({ title: "Course" });
    expect(events()).toHaveLength(1);
    expect(events()[0]).toMatchObject({
      category: "AI COST",
      operationCategory: "AI TEXT",
      kind: "text",
      stage: "test_course",
      attempt: 1,
      outcome: "response_received",
      usage: { inputTokens: 2_000, cachedInputTokens: 1_000, cacheWriteTokens: 0 },
      inputCostEstimate: { usd: 0.00011 },
    });
    expect(events()[0].schemaHash).toMatch(/^[a-f0-9]{64}$/);
    expect(events()[0].developerPromptHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(events())).not.toContain("PRIVATE");
    const body = JSON.parse(transport.mock.calls[0][1]);
    expect(body).toMatchObject({ store: false, input: [{ role: "developer", content: [{ type: "input_text", text: "PRIVATE PROMPT", prompt_cache_breakpoint: { mode: "explicit" } }] }, { role: "user", content: [{ type: "input_text", text: "PRIVATE SOURCE" }] }], reasoning: { effort: "medium" }, text: { format: { strict: true } } });
    expect(body.prompt_cache_options).toEqual({ mode: "explicit", ttl: "30m" });
    expect(body.input[1].content[0].prompt_cache_breakpoint).toBeUndefined();
    expect(events()[0].cachePolicy).toBe("shared_developer_v1");
  });

  it("counts both invalid-JSON and successful attempts with a shared operation ID", async () => {
    transport.mockResolvedValueOnce(response({ output_text: "invalid" })).mockResolvedValueOnce(response({ output_text: '{"title":"Fixed"}' }));
    await expect(request()).resolves.toEqual({ title: "Fixed" });
    expect(events().map((event) => event.attempt)).toEqual([1, 2]);
    expect(events()[0].operationId).toBe(events()[1].operationId);
    expect(events().every((event) => event.usage.inputTokens === 2_000)).toBe(true);
    const first = JSON.parse(transport.mock.calls[0][1]);
    const second = JSON.parse(transport.mock.calls[1][1]);
    expect(second.input.slice(0, 2)).toEqual(first.input);
    expect(second.input[2]).toMatchObject({ role: "user", content: [{ type: "input_text", text: expect.stringContaining("previous response was not valid JSON") }] });
  });

  it("records incomplete responses before the output-limit error is thrown", async () => {
    transport.mockResolvedValueOnce(response({ status: "incomplete", incomplete_details: { reason: "max_output_tokens" } }));
    await expect(request()).rejects.toMatchObject({ status: 422 });
    expect(events()).toHaveLength(1);
    expect(events()[0]).toMatchObject({ providerStatus: "incomplete", usage: { outputTokens: 30 } });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("records rate-limit responses and their retry once each", async () => {
    vi.useFakeTimers();
    transport.mockResolvedValueOnce(response({ usage: null, error: { code: "rate_limit_exceeded", message: "PRIVATE ERROR" } }, 429))
      .mockResolvedValueOnce(response({ output_text: "{}" }));
    const pending = request();
    await vi.runAllTimersAsync();
    await expect(pending).resolves.toEqual({});
    expect(events()).toHaveLength(2);
    expect(events()[0]).toMatchObject({ httpStatus: 429, providerErrorCode: "rate_limit_exceeded", usage: { inputTokens: null }, inputCostEstimate: { usd: null } });
    expect(JSON.stringify(events())).not.toContain("PRIVATE");
  });

  it("records a transport failure as unknown usage and preserves the retry budget", async () => {
    vi.useFakeTimers();
    transport.mockRejectedValueOnce(Object.assign(new Error("PRIVATE FAILURE"), { code: "ECONNRESET" }))
      .mockResolvedValueOnce(response({ output_text: "{}" }));
    const pending = request();
    await vi.runAllTimersAsync();
    await expect(pending).resolves.toEqual({});
    expect(events()).toHaveLength(2);
    expect(events()[0]).toMatchObject({ attempt: 1, outcome: "transport_error", transportErrorCode: "ECONNRESET", httpStatus: null, usage: { inputTokens: null, cacheWriteTokens: null } });
    expect(events()[1].attempt).toBe(2);
  });

  it("records unreadable response bodies as unknown without an invented zero-cost result", async () => {
    transport.mockResolvedValueOnce(new Response("not JSON"));
    await expect(request()).rejects.toMatchObject({ status: 502 });
    expect(events()).toHaveLength(1);
    expect(events()[0]).toMatchObject({ usage: { inputTokens: null }, inputCostEstimate: { usd: null, unavailableReason: "incomplete_usage" } });
  });

  it("does not fail or retry a paid generation when the log sink fails", async () => {
    vi.mocked(console.info).mockImplementation(() => { throw new Error("Log sink failed"); });
    transport.mockResolvedValueOnce(response({ output_text: "{}" }));
    await expect(request()).resolves.toEqual({});
    expect(transport).toHaveBeenCalledTimes(1);
  });
});
