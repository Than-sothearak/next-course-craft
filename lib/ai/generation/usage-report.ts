import { z } from "zod";

const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable().catch(null);
const label = z.string().regex(/^[a-zA-Z0-9_.:/-]{1,160}$/).nullable().catch(null);
const hash = z.string().regex(/^[a-f0-9]{64}$/).nullable().catch(null);
const dollars = z.number().finite().nonnegative().nullable().catch(null);
const usageSchema = z.object({
  inputTokens: count, cachedInputTokens: count, cacheWriteTokens: count,
  cacheWrite30mTokens: count, cacheWrite12hTokens: count,
  outputTokens: count, reasoningTokens: count,
});
const eventSchema = z.object({
  event: z.literal("ai.generation.usage"), version: z.literal(1),
  operationId: label, attempt: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  courseId: label,
  at: z.iso.datetime().nullable().catch(null),
  actualModel: label, requestedModel: label, stage: label,
  kind: z.enum(["text", "image"]),
  cachePolicy: z.enum(["shared_developer_v1", "provider_default"]).nullable().catch(null),
  serviceTier: label, schemaHash: hash, developerPromptHash: hash,
  outcome: z.enum(["response_received", "transport_error"]),
  httpStatus: z.number().int().min(100).max(599).nullable().catch(null),
  providerStatus: label,
  durationMs: z.number().finite().nonnegative().nullable().catch(null),
  usage: usageSchema.catch(() => usageSchema.parse({})),
  inputCostEstimate: z.object({
    usd: dollars,
    scope: z.literal("mainline_model_input_only"),
    pricingAsOf: z.iso.date(),
    assumedStandardTier: z.boolean(),
  }).nullable().catch(null),
  textCostEstimate: z.object({
    inputUsd: dollars, outputUsd: dollars, usd: dollars,
    scope: z.literal("mainline_model_text_only"), pricingAsOf: z.iso.date(),
  }).nullable().catch(null),
});
type UsageEvent = z.infer<typeof eventSchema>;
type TokenField = keyof UsageEvent["usage"];
type Counter = { sum: number | null; knownEvents: number; missingEvents: number };
const tokenFields: TokenField[] = ["inputTokens", "cachedInputTokens", "cacheWriteTokens", "cacheWrite30mTokens", "cacheWrite12hTokens", "outputTokens", "reasoningTokens"];

function emptyTotals() {
  return {
    events: 0, retryAttempts: 0, observedProviderFailures: 0, inconsistentUsageEvents: 0,
    inconsistentCostEvents: 0, imageRequests: 0,
    tokens: Object.fromEntries(tokenFields.map((field) => [field, { sum: null, knownEvents: 0, missingEvents: 0 }])) as Record<TokenField, Counter>,
    cacheReadRate: { ratio: null as number | null, pairedEvents: 0, excludedEvents: 0, inputTokens: 0, cachedTokens: 0 },
    estimatedInputCost: { usd: null as number | null, knownEvents: 0, missingEvents: 0 },
    estimatedOutputCost: { usd: null as number | null, knownEvents: 0, missingEvents: 0 },
    estimatedTextCost: { usd: null as number | null, knownEvents: 0, missingEvents: 0 },
    duration: { meanMs: null as number | null, knownEvents: 0, totalMs: 0 },
  };
}

function inconsistentUsage(usage: UsageEvent["usage"]) {
  const { inputTokens: input, cachedInputTokens: reads, cacheWriteTokens: writes, cacheWrite30mTokens: short, cacheWrite12hTokens: long } = usage;
  return (input !== null && reads !== null && reads > input) ||
    (input !== null && writes !== null && writes > input) ||
    (input !== null && reads !== null && writes !== null && reads + writes > input) ||
    (writes !== null && short !== null && short > writes) ||
    (writes !== null && long !== null && long > writes) ||
    (writes !== null && short !== null && long !== null && short + long !== writes);
}

function addEvent(totals: ReturnType<typeof emptyTotals>, event: UsageEvent) {
  totals.events++;
  if (event.kind === "image") totals.imageRequests++;
  if (event.attempt > 1) totals.retryAttempts++;
  if (event.outcome === "transport_error" || (event.httpStatus !== null && event.httpStatus >= 400) ||
    ["incomplete", "failed", "cancelled"].includes(event.providerStatus ?? "")) totals.observedProviderFailures++;
  const inconsistent = inconsistentUsage(event.usage);
  if (inconsistent) totals.inconsistentUsageEvents++;
  for (const field of tokenFields) {
    const counter = totals.tokens[field];
    const value = event.usage[field];
    if (value === null || inconsistent) counter.missingEvents++;
    else { counter.sum = (counter.sum ?? 0) + value; counter.knownEvents++; }
  }
  const { inputTokens, cachedInputTokens } = event.usage;
  if (inputTokens !== null && cachedInputTokens !== null && !inconsistent) {
    totals.cacheReadRate.pairedEvents++;
    totals.cacheReadRate.inputTokens += inputTokens;
    totals.cacheReadRate.cachedTokens += cachedInputTokens;
  } else totals.cacheReadRate.excludedEvents++;
  totals.cacheReadRate.ratio = totals.cacheReadRate.inputTokens > 0
    ? totals.cacheReadRate.cachedTokens / totals.cacheReadRate.inputTokens : null;
  const cost = event.inputCostEstimate?.usd;
  if (cost != null && !inconsistent) {
    totals.estimatedInputCost.usd = (totals.estimatedInputCost.usd ?? 0) + cost;
    totals.estimatedInputCost.knownEvents++;
  } else totals.estimatedInputCost.missingEvents++;
  const text = event.textCostEstimate;
  const differs = (a: number, b: number) => Math.abs(a - b) > Math.max(1e-12, Math.max(a, b) * 1e-9);
  const invalidCost = text !== null && (
    (text.inputUsd !== null && cost != null && differs(text.inputUsd, cost)) ||
    (text.usd !== null && text.inputUsd !== null && text.outputUsd !== null && differs(text.usd, text.inputUsd + text.outputUsd)) ||
    (event.inputCostEstimate !== null && text.pricingAsOf !== event.inputCostEstimate.pricingAsOf)
  );
  if (invalidCost) totals.inconsistentCostEvents++;
  if (text?.outputUsd != null && !inconsistent && !invalidCost) {
    totals.estimatedOutputCost.usd = (totals.estimatedOutputCost.usd ?? 0) + text.outputUsd;
    totals.estimatedOutputCost.knownEvents++;
  } else totals.estimatedOutputCost.missingEvents++;
  // Sum only attempts with both priced components. Adding independent partial
  // input/output sums could otherwise look like a fully priced course total.
  if (cost != null && text?.inputUsd != null && text.outputUsd !== null && !inconsistent && !invalidCost) {
    totals.estimatedTextCost.usd = (totals.estimatedTextCost.usd ?? 0) + cost + text.outputUsd;
    totals.estimatedTextCost.knownEvents++;
  } else totals.estimatedTextCost.missingEvents++;
  if (event.durationMs !== null) {
    totals.duration.knownEvents++;
    totals.duration.totalMs += event.durationMs;
    totals.duration.meanMs = totals.duration.totalMs / totals.duration.knownEvents;
  }
}

export function createUsageReport() {
  const ingestion = { lines: 0, ignoredLines: 0, invalidEvents: 0, duplicateEvents: 0, conflictingDuplicateEvents: 0, unidentifiedEvents: 0 };
  const totals = emptyTotals();
  const seen = new Map<string, string>();
  const operations = new Set<string>();
  const courses = new Map<string | null, ReturnType<typeof emptyTotals>>();
  const groups = new Map<string, { dimensions: ReturnType<typeof dimensions>; totals: ReturnType<typeof emptyTotals> }>();
  function dimensions(event: UsageEvent) {
    return {
      dayUtc: event.at?.slice(0, 10) ?? null,
      courseId: event.courseId,
      model: event.actualModel ?? event.requestedModel,
      kind: event.kind, stage: event.stage, cachePolicy: event.cachePolicy,
      serviceTier: event.serviceTier, schemaHash: event.schemaHash, developerPromptHash: event.developerPromptHash,
      pricingAsOf: event.inputCostEstimate?.pricingAsOf ?? null,
      assumedStandardTier: event.inputCostEstimate?.assumedStandardTier ?? null,
    };
  }
  return {
    addLine(line: string) {
      ingestion.lines++;
      // Accept stdout prefixes such as a timestamp, but never echo source lines.
      const start = line.indexOf("{");
      let value: unknown;
      try { value = JSON.parse(start < 0 ? line : line.slice(start)); }
      catch {
        if (line.includes('"ai.generation.usage"')) ingestion.invalidEvents++;
        else ingestion.ignoredLines++;
        return;
      }
      if (!value || typeof value !== "object" || !("event" in value) || value.event !== "ai.generation.usage") {
        ingestion.ignoredLines++; return;
      }
      const parsed = eventSchema.safeParse(value);
      if (!parsed.success) { ingestion.invalidEvents++; return; }
      const event = parsed.data;
      if (event.operationId !== null) {
        const key = JSON.stringify([event.operationId, event.attempt]);
        const serialized = JSON.stringify(event);
        const previous = seen.get(key);
        if (previous !== undefined) {
          ingestion.duplicateEvents++;
          if (previous !== serialized) ingestion.conflictingDuplicateEvents++;
          return;
        }
        seen.set(key, serialized); operations.add(event.operationId);
      } else ingestion.unidentifiedEvents++;
      addEvent(totals, event);
      let course = courses.get(event.courseId);
      if (!course) { course = emptyTotals(); courses.set(event.courseId, course); }
      addEvent(course, event);
      const fields = dimensions(event), key = JSON.stringify(fields);
      let group = groups.get(key);
      if (!group) { group = { dimensions: fields, totals: emptyTotals() }; groups.set(key, group); }
      addEvent(group.totals, event);
    },
    result() {
      return {
        version: 1, ingestion, identifiedOperations: operations.size, totals,
        courses: [...courses.entries()].sort(([a], [b]) => (a ?? "").localeCompare(b ?? "")).map(([courseId, totals]) => ({ courseId, totals })),
        groups: [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, group]) => group),
        limitations: [
          "Token counters are reported measurements; USD amounts are stored input/output estimates, not invoices. Course totals cover captured attempts only, including retries and failures.",
          "Combined text totals sum only attempts with both input and output priced. Missing estimates make the known subtotal partial; older input-only events have unknown output costs.",
          "Events without a course ID remain in an unknown-course bucket; course identity is never inferred from adjacent progress lines.",
          "Unknown or inconsistent usage is excluded with coverage counts. No available measurements means null, not zero.",
          "Retry attempts count attempt > 1 within a provider invocation; application-level repairs have separate operation IDs.",
          "Observed provider failures do not identify every validation failure. Accepted lessons and cost per valid lesson are unavailable in these logs.",
          "Duplicate operation/attempt entries retain the first occurrence; conflicts are counted. Entries without an operation ID cannot be deduplicated.",
          "Groups are descriptive; differing workloads and cold writes prevent interpreting their cost difference as measured savings.",
          "Image-tool token counters and image-generation charges are excluded; text-model costs for image requests are included when available.",
        ],
      };
    },
  };
}

export function formatUsageReport(report: ReturnType<ReturnType<typeof createUsageReport>["result"]>) {
  const value = (n: number | null) => n === null ? "unknown" : String(n);
  const money = (cost: { usd: number | null; knownEvents: number; missingEvents: number }, attempts: number) =>
    `${cost.usd === null ? "unknown" : "$" + cost.usd.toFixed(8)} (${cost.knownEvents}/${attempts} attempts priced${cost.missingEvents ? "; partial coverage" : ""})`;
  const describe = (total: ReturnType<typeof emptyTotals>) => [
    `Attempts: ${total.events}; retry attempts: ${total.retryAttempts}; observed provider failures: ${total.observedProviderFailures}`,
    ...tokenFields.map((field) => `${field}: ${value(total.tokens[field].sum)} (${total.tokens[field].knownEvents}/${total.events} events measured)`),
    `Cache read rate: ${total.cacheReadRate.ratio === null ? "unknown" : (100 * total.cacheReadRate.ratio).toFixed(2) + "%"} (${total.cacheReadRate.pairedEvents}/${total.events} paired events)`,
    `Estimated input USD: ${total.estimatedInputCost.usd === null ? "unknown" : total.estimatedInputCost.usd.toFixed(8)} (${total.estimatedInputCost.knownEvents}/${total.events} events priced)`,
    `Estimated output cost: ${money(total.estimatedOutputCost, total.events)}`,
    `Estimated text total: ${money(total.estimatedTextCost, total.events)}`,
    `Image-generation charges: excluded (${total.imageRequests} image requests observed)`,
    `Inconsistent cost estimates excluded: ${total.inconsistentCostEvents}`,
    `Mean attempt duration ms: ${value(total.duration.meanMs)}`,
  ];
  return [
    "AI generation usage report", ...describe(report.totals),
    `Identified provider operations: ${report.identifiedOperations}`,
    `Ignored lines: ${report.ingestion.ignoredLines}; invalid events: ${report.ingestion.invalidEvents}; duplicates: ${report.ingestion.duplicateEvents}; duplicate conflicts: ${report.ingestion.conflictingDuplicateEvents}; unidentified events: ${report.ingestion.unidentifiedEvents}`,
    ...report.courses.flatMap(({ courseId, totals }) => [
      "", `Course: ${courseId ?? "unknown (no course ID in logs)"} — captured requests`,
      `Attempts: ${totals.events}; retries: ${totals.retryAttempts}; observed provider failures: ${totals.observedProviderFailures}`,
      `Input: ${money(totals.estimatedInputCost, totals.events)}`,
      `Output: ${money(totals.estimatedOutputCost, totals.events)}`,
      `Estimated text total: ${money(totals.estimatedTextCost, totals.events)}`,
      `Image-generation charges: excluded (${totals.imageRequests} image requests observed)`,
    ]),
    ...report.groups.flatMap((group) => ["", `Group: ${JSON.stringify(group.dimensions)}`, ...describe(group.totals)]),
    "", ...report.limitations,
  ].join("\n");
}
