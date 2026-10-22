import { DashboardError } from "@/lib/dashboard/rules";

// Transport retries and content corrections share this allowance. Nested repair
// loops must not multiply provider requests or reset the stage's timeout.
export function createGenerationBudget(timeoutMs: number) {
  return { deadline: Date.now() + timeoutMs, remainingAttempts: 2 };
}

export type GenerationBudget = ReturnType<typeof createGenerationBudget>;

export function generationConnectionErrorCode(error: unknown) {
  const cause = error instanceof Error ? error.cause : undefined;
  const connectionError = cause && typeof cause === "object" && "code" in cause ? cause : error;
  return connectionError && typeof connectionError === "object" && "code" in connectionError && typeof connectionError.code === "string"
    ? connectionError.code
    : undefined;
}

export class GenerationProviderError extends DashboardError {
  constructor(
    message: string,
    status: number,
    readonly retryable: boolean,
    readonly retryAfterMs = 0,
  ) {
    super(message, status);
  }
}

export function providerRetryAfterMs(headers: Headers, now = Date.now()) {
  const value = headers.get("retry-after");
  if (!value) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - now) : 0;
}

export function generationRetryDelay(error: unknown, budget: GenerationBudget) {
  if (budget.remainingAttempts < 1) return null;
  let retryAfterMs = 0;
  if (error instanceof GenerationProviderError) {
    if (!error.retryable) return null;
    retryAfterMs = error.retryAfterMs;
  } else {
    const code = generationConnectionErrorCode(error);
    // A timed-out generation may still be running at the provider. Do not
    // automatically submit a duplicate expensive generation in that case.
    if (!["ECONNRESET", "ECONNREFUSED", "EHOSTUNREACH", "ENETUNREACH", "EAI_AGAIN"].includes(String(code)))
      return null;
  }
  const delayMs = Math.max(750, retryAfterMs) + Math.floor(Math.random() * 250);
  // Honor Retry-After rather than retrying early when its delay is too long.
  if (delayMs > 30_000 || Date.now() + delayMs + 1_000 >= budget.deadline) return null;
  return delayMs;
}
