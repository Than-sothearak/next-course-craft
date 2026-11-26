import { z } from "zod";
import { DashboardError } from "@/lib/dashboard/rules";

// Verify capabilities before adding model IDs; environment overrides may select
// models that do not accept explicit breakpoints or the new TTL controls.
const supportedModels = new Set(["gpt-6-luna", "gpt-6-astra", "gpt-6.1-sol"]);
const modeSchema = z.enum(["explicit", "provider_default"]);

export function structuredPromptCache(model: string) {
  if (!supportedModels.has(model)) return undefined;
  const mode = modeSchema.safeParse(process.env.OPENAI_PROMPT_CACHE_MODE || "explicit");
  if (!mode.success)
    throw new DashboardError("OPENAI_PROMPT_CACHE_MODE must be explicit or provider_default.", 503);
  return mode.data === "explicit" ? { mode: "explicit" as const, ttl: "30m" as const } : undefined;
}
