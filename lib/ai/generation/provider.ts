import { DashboardError } from "@/lib/dashboard/rules";
import { createGenerationBudget, generationConnectionErrorCode, GenerationProviderError, generationRetryDelay, providerRetryAfterMs, type GenerationBudget } from "../generation-retry";
import { requestGenerationResponse } from "./transport";

async function readOutputText(response: Response) {
  const body: unknown = await response.json().catch(() => null);
  const record = body && typeof body === "object"
    ? body as { output_text?: unknown; output?: unknown; status?: unknown; incomplete_details?: unknown; error?: unknown }
    : undefined;
  if (!response.ok) {
    const providerError = record?.error && typeof record.error === "object"
      ? record.error as { code?: unknown; type?: unknown }
      : undefined;
    if ([providerError?.code, providerError?.type].some((code) =>
      code === "insufficient_quota" || code === "billing_hard_limit_reached"))
      throw new GenerationProviderError(
        "The AI account has reached its billing or usage limit. Check the provider account before retrying.",
        503,
        false,
      );
    if (response.status === 429 || providerError?.code === "rate_limit_exceeded")
      throw new GenerationProviderError(
        "AI generation is temporarily rate limited. Wait a moment and try again.",
        429,
        true,
        providerRetryAfterMs(response.headers),
      );
    if (response.status === 401 || response.status === 403)
      throw new DashboardError(
        "The AI provider rejected the configured API key.",
        503,
      );
    throw new GenerationProviderError(
      response.status === 400
        ? "The AI provider rejected the generation request. Check the configured model and generation settings."
        : "AI course generation failed. Please try again.",
      502,
      [408, 409, 500, 502, 503, 504].includes(response.status),
      providerRetryAfterMs(response.headers),
    );
  }
  if (!record)
    throw new DashboardError(
      "The AI provider returned an unreadable response.",
      502,
    );
  if (record.status === "incomplete") {
    const details = record.incomplete_details && typeof record.incomplete_details === "object"
      ? record.incomplete_details as { reason?: unknown }
      : undefined;
    if (details?.reason === "max_output_tokens")
      throw new DashboardError(
        "The AI response reached this generation stage's output limit. Retry the stage or reduce the amount of source content in one item.",
        422,
      );
    throw new DashboardError(
      "The AI provider stopped before completing this generation stage. Please retry.",
      502,
    );
  }
  if (typeof record.output_text === "string") return record.output_text;
  if (Array.isArray(record.output)) {
    const textParts: string[] = [];
    let refused = false;
    for (const item of record.output) {
      if (
        !item ||
        typeof item !== "object" ||
        !("content" in item) ||
        !Array.isArray(item.content)
      )
        continue;
      for (const content of item.content) {
        if (content && typeof content === "object" && "type" in content && content.type === "refusal")
          refused = true;
        if (
          content &&
          typeof content === "object" &&
          "type" in content &&
          content.type === "output_text" &&
          "text" in content &&
          typeof content.text === "string"
        ) textParts.push(content.text);
      }
    }
    if (textParts.length) return textParts.join("\n");
    if (refused)
      throw new DashboardError(
        "The AI provider could not complete this generation stage. Review the source material or prompt and retry.",
        422,
      );
  }
  throw new DashboardError(
    "The AI provider could not produce a course from that request. Try changing the prompt or source material.",
    422,
  );
}

export async function requestStructuredJson({
  model,
  developerPrompt,
  content,
  schemaName,
  schema,
  maxOutputTokens,
  timeoutMs,
  budget = createGenerationBudget(timeoutMs),
  reasoningEffort = "medium",
}: {
  model: string;
  developerPrompt: string;
  content: Array<Record<string, string>>;
  schemaName: string;
  schema: object;
  maxOutputTokens: number;
  timeoutMs: number;
  budget?: GenerationBudget;
  reasoningEffort?: "low" | "medium";
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey)
    throw new DashboardError(
      "AI generation is not configured. Set OPENAI_API_KEY on the server.",
      503,
    );

  let lastParseError: unknown;
  while (budget.remainingAttempts > 0) {
    const remainingMs = budget.deadline - Date.now();
    if (remainingMs <= 0) throw providerConnectionError(new DOMException("Generation deadline exceeded", "TimeoutError"), "AI provider");
    budget.remainingAttempts -= 1;
    let outputText: string;
    try {
      const response = await requestGenerationResponse(
        apiKey,
        JSON.stringify({
          model,
          store: false,
          reasoning: model.startsWith("gpt-6") ? { effort: reasoningEffort } : undefined,
          max_output_tokens: maxOutputTokens,
          input: [
            { role: "developer", content: developerPrompt },
            {
              role: "user",
              content: !lastParseError ? content : [
                ...content,
                { type: "input_text", text: "Your previous response was not valid JSON. Return the complete response again as valid JSON matching the required schema. Do not omit any requested source content." },
              ],
            },
          ],
          text: {
            format: {
              type: "json_schema",
              name: schemaName,
              strict: true,
              schema,
            },
          },
        }),
        AbortSignal.timeout(remainingMs),
      );
      outputText = await readOutputText(response);
    } catch (error) {
      const delayMs = generationRetryDelay(error, budget);
      if (delayMs !== null) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      if (error instanceof DashboardError) throw error;
      throw providerConnectionError(error, "AI provider");
    }

    try {
      return JSON.parse(outputText) as unknown;
    } catch (error) {
      lastParseError = error;
    }
  }
  console.error("AI provider returned invalid structured JSON after a retry", { schemaName, lastParseError });
  throw new DashboardError(
    "The AI provider returned invalid structured content twice. Please retry this generation stage.",
    502,
  );
}

export function providerConnectionError(error: unknown, subject: string) {
  const code = generationConnectionErrorCode(error);
  const name = error instanceof Error ? error.name : "UnknownError";
  console.error("AI generation provider connection failed", {
    subject,
    name,
    code,
  });

  if (name === "TimeoutError" || code === "ETIMEDOUT")
    return new DashboardError(
      subject === "AI provider"
        ? "Course generation took too long. Try requesting fewer lessons or using a smaller source file."
        : "Image generation took too long. Disable generated images or try again.",
      504,
    );
  if (code === "EACCES")
    return new DashboardError(
      "This app server is blocked from making outbound HTTPS requests to api.openai.com. Allow outbound access, then retry.",
      502,
    );
  if (
    [
      "ECONNREFUSED",
      "ECONNRESET",
      "EHOSTUNREACH",
      "ENETUNREACH",
      "ENOTFOUND",
      "EAI_AGAIN",
    ].includes(code ?? "")
  )
    return new DashboardError(
      "This app server cannot reach api.openai.com. Check DNS and outbound HTTPS access, then retry.",
      502,
    );
  return new DashboardError(
    "Could not reach the AI provider. Check the server connection and try again.",
    502,
  );
}
