export type GenerationProgressStatus =
  | "STARTED"
  | "IN PROGRESS"
  | "WAITING"
  | "DONE"
  | "FAILED"
  | "CANCELLED"
  | "SKIPPED";

export type GenerationProgressEvent = {
  status: GenerationProgressStatus;
  task: string;
  category?: "COURSE" | "LESSON" | "AI TEXT" | "AI IMAGE" | "AI CACHE" | "AI COST" | "PROGRESS" | "DATABASE" | "AUTH" | "STORAGE" | "RETRY" | "SYSTEM" | "PERFORMANCE" | "SUMMARY";
  courseId?: string;
  jobId?: string;
  sessionId?: string;
  current?: number;
  total?: number;
  completedLessons?: number;
  progressPercent?: number;
  generatedImageCount?: number;
  durationMs?: number;
  detail?: string;
  at?: Date;
};

export type GenerationSummary = {
  courseTitle?: string | null;
  courseId: string;
  totalLessons: number | null;
  generatedImages: number | null;
  totalAiRequests: number | null;
  inputTokens: number | null;
  cachedInputTokens: number | null;
  uncachedInputTokens: number | null;
  outputTokens: number | null;
  reasoningTokens: number | null;
  cacheWriteTokens: number | null;
  imageTokens: number | null;
  imageTextInputTokens: number | null;
  cachedImageTextInputTokens: number | null;
  imageInputTokens: number | null;
  cachedImageInputTokens: number | null;
  imageTextOutputTokens: number | null;
  imageOutputTokens: number | null;
  imageTotalTokens: number | null;
  recordedTextTokens: number | null;
  recordedImageTokens: number | null;
  totalTokens: number | null;
  usageCompleteness: "complete" | "partial" | "unavailable";
  cacheHitPercent: number | null;
  imageCacheHitPercent: number | null;
  estimatedCacheSavingsUsd: number | null;
  textGenerationCostUsd: number | null;
  imageGenerationCostUsd: number | null;
  imageGenerationCostStatus: "calculated" | "estimated" | "unavailable";
  combinedGenerationCostUsd: number | null;
  failedRequests: number | null;
  retries: number | null;
  activeProcessingMs: number | null;
  userWaitingMs: number | null;
  totalElapsedMs: number | null;
  finalStatus: "DONE" | "FAILED" | "CANCELLED";
  sessionId?: string;
  jobId?: string;
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Phnom_Penh",
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const timeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Phnom_Penh",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h12",
});
const levelWeight = { DEBUG: 10, PROGRESS: 20, SUCCESS: 20, INFO: 20, COST: 20, WARNING: 30, ERROR: 40 } as const;
const ansi = {
  gray: "\u001b[90m",
  blue: "\u001b[34m",
  green: "\u001b[32m",
  cyan: "\u001b[36m",
  magenta: "\u001b[35m",
  yellow: "\u001b[33m",
  red: "\u001b[31m",
  bold: "\u001b[1m",
} as const;
const levelColor = {
  DEBUG: ansi.gray,
  PROGRESS: ansi.blue,
  SUCCESS: ansi.green,
  INFO: ansi.cyan,
  COST: ansi.magenta,
  WARNING: ansi.yellow,
  ERROR: ansi.red,
} as const;
const resetColor = "\u001b[0m";
const recentProgress = new Map<string, string>();
const generationTimes = new Map<string, { startedAt: number; lastAt: number; waitingMs: number; waiting: boolean }>();
const generationImageCounts = new Map<string, number>();
const maxRecentProgress = 2_000;

type ConsoleLevel = keyof typeof levelWeight;
type ConsoleCategory = NonNullable<GenerationProgressEvent["category"]>;
type GenerationLogSection = { title: string; fields: Record<string, unknown> };
type GenerationLogPresentation = {
  layout?: "compact" | "multiline" | "compact-multiline";
  tone?: ConsoleLevel;
  indicator?: string;
  sections?: GenerationLogSection[];
  lines?: string[];
  sessionSeparator?: boolean;
};

function envChoice<T extends string>(value: string | undefined, choices: readonly T[], fallback: T): T {
  return choices.includes(value as T) ? value as T : fallback;
}

function allowsLevel(level: ConsoleLevel) {
  const configured = envChoice(process.env.LOG_LEVEL?.toLowerCase(), ["debug", "progress", "info", "success", "cost", "warning", "error", "silent"] as const, "info");
  if (configured === "silent") return false;
  const minimum = configured === "debug" ? 10
    : configured === "warning" ? 30
      : configured === "error" ? 40
        : 20;
  return levelWeight[level] >= minimum;
}

export function generationLogLevelEnabled(level: ConsoleLevel) {
  return allowsLevel(level);
}

function colorsEnabled() {
  const setting = envChoice(process.env.LOG_COLORS?.toLowerCase(), ["auto", "always", "never"] as const, "auto");
  if (setting === "never") return false;
  if (setting === "always") return true;
  if (process.env.NO_COLOR !== undefined || process.env.NODE_DISABLE_COLORS !== undefined) return false;
  if (process.env.FORCE_COLOR !== undefined) return process.env.FORCE_COLOR !== "0";
  return Boolean(process.stdout.isTTY) && process.env.TERM !== "dumb";
}

function paint(value: string, color: string, enabled: boolean, bold = false) {
  if (!enabled) return value;
  return `${bold ? ansi.bold : ""}${color}${value}${resetColor}`;
}

function safeText(value: string) {
  return value
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [REDACTED]")
    .replace(/\b(?:sk-[A-Za-z0-9_-]{12,}|AKIA[A-Z0-9]{16})\b/g, "[REDACTED]")
    .replace(/\b(api[_-]?key|password|secret|access[_-]?token|auth[_-]?token)\s*[:=]\s*[^,\s;]+/gi, "$1=[REDACTED]")
    .trim()
    .slice(0, 500);
}

function levelIndicator(level: ConsoleLevel) {
  switch (level) {
    case "DEBUG": return "·";
    case "PROGRESS": return "▸";
    case "SUCCESS": return "✓";
    case "INFO": return "●";
    case "COST": return "◆";
    case "WARNING": return "⚠";
    case "ERROR": return "✗";
  }
}

function displayFieldValue(key: string, value: unknown, fields: Record<string, unknown>) {
  if (value === undefined || value === null ||
    (key === "courseId" && fields.course !== undefined) ||
    (key === "jobId" && fields.job !== undefined) ||
    (key === "sessionId" && fields.session !== undefined)) return null;
  if (["courseId", "jobId", "sessionId"].includes(key) && typeof value === "string")
    return shortGenerationId(value) ?? "";
  return typeof value === "string" ? safeText(value) : String(value);
}

function humanFieldLabel(key: string) {
  const fieldLabel = key === "courseId" ? "course"
    : key === "jobId" ? "job"
      : key === "sessionId" ? "session" : key;
  return safeText(fieldLabel.replace(/([a-z0-9])([A-Z])/g, "$1 $2")).replace(/^./, (character) => character.toUpperCase());
}

function compactFieldLabel(key: string) {
  return key === "courseId" ? "course"
    : key === "jobId" ? "job"
      : key === "sessionId" ? "session" : key;
}

function safeStructured(value: unknown): unknown {
  if (typeof value === "string") return safeText(value);
  if (Array.isArray(value)) return value.map(safeStructured);
  if (value !== null && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [safeText(key), safeStructured(item)]));
  return value;
}

export function formatCambodiaTimestamp(at: Date = new Date()) {
  return `${dateFormatter.format(at)}, ${timeFormatter.format(at)}`;
}

export function shortGenerationId(id: string | undefined) {
  return id && id.length > 12 ? `${id.slice(0, 8)}...` : id;
}

export function writeGenerationLog(
  level: ConsoleLevel,
  category: ConsoleCategory,
  message: string,
  fields: Record<string, unknown> = {},
  sink: (...data: unknown[]) => void = console.log,
  formatOverride?: "human" | "json",
  timestampAt?: Date,
  presentation: GenerationLogPresentation = {},
) {
  if (!generationLogLevelEnabled(level)) return;
  const safeMessage = safeText(message);
  const format = formatOverride ?? envChoice(process.env.LOG_FORMAT?.toLowerCase(), ["human", "json"] as const, "human");
  const at = timestampAt ?? new Date();
  if (format === "json") {
    sink(JSON.stringify({
      event: "generation.log",
      at: at.toISOString(),
      level,
      category,
      message: safeMessage,
      ...(safeStructured(fields) as Record<string, unknown>),
    }));
    return;
  }
  const timestamp = formatCambodiaTimestamp(at);
  const useColor = colorsEnabled();
  const tone = presentation.tone ?? level;
  const timestampLabel = paint(`[${timestamp}]`, ansi.gray, useColor);
  const levelLabel = paint(`[${level}]`, levelColor[level], useColor, true);
  const categoryLabel = paint(`[${category}]`, ansi.cyan, useColor, true);
  const indicator = paint(presentation.indicator ?? levelIndicator(tone), levelColor[tone], useColor);
  const heading = `${timestampLabel} ${levelLabel} ${categoryLabel} ${indicator} ${paint(safeMessage, levelColor[tone], useColor, true)}`;

  if (presentation.layout === "compact-multiline") {
    const separator = paint(`  ${"─".repeat(48)}`, ansi.gray, useColor);
    const lines = [
      ...(presentation.sessionSeparator ? [separator] : []),
      heading,
      separator,
      ...(presentation.lines ?? []).map((line) => {
        const safeLine = safeText(line);
        const color = /cost|\$/i.test(safeLine) ? ansi.magenta : ansi.gray;
        return `  ${paint(safeLine, color, useColor)}`;
      }),
      ...(presentation.sessionSeparator ? [separator] : []),
    ];
    sink(lines.join("\n"));
    return;
  }

  if (presentation.layout === "multiline") {
    const sections = presentation.sections ?? [{ title: "Details", fields }];
    const allRows = sections.flatMap((section) => Object.entries(section.fields)
      .map(([key, value]) => ({ key, label: humanFieldLabel(key), value: displayFieldValue(key, value, section.fields), section: section.title }))
      .filter((row): row is { key: string; label: string; value: string; section: string } => row.value !== null));
    const width = Math.max(0, ...allRows.map((row) => row.label.length));
    const lines = [
      ...(presentation.sessionSeparator ? [paint(`  ${"─".repeat(48)}`, ansi.gray, useColor)] : []),
      heading,
      paint(`  ${"─".repeat(48)}`, ansi.gray, useColor),
    ];
    for (const [index, section] of sections.entries()) {
      if (index > 0) lines.push("");
      lines.push(paint(`  ${safeText(section.title).toUpperCase()}`, ansi.cyan, useColor, true));
      for (const row of allRows.filter((item) => item.section === section.title)) {
        const color = /cost|savings/i.test(section.title) ? ansi.magenta : ansi.gray;
        lines.push(`  ${paint(row.label.padEnd(width), ansi.gray, useColor)}  ${paint(row.value, color, useColor)}`);
      }
    }
    if (presentation.sessionSeparator) lines.push(paint(`  ${"─".repeat(48)}`, ansi.gray, useColor));
    sink(lines.join("\n"));
    return;
  }

  const body = Object.entries(fields)
    .map(([key, value]) => {
      const displayed = displayFieldValue(key, value, fields);
      return displayed === null ? null : `${compactFieldLabel(key)}: ${displayed}`;
    })
    .filter((value): value is string => value !== null)
    .join(" | ");
  const compact = `${heading}${body ? ` | ${body}` : ""}`;
  if (presentation.sessionSeparator) {
    const separator = paint(`  ${"─".repeat(48)}`, ansi.gray, useColor);
    sink([separator, compact, separator].join("\n"));
    return;
  }
  sink(compact);
}

function categoryFor(task: string): ConsoleCategory {
  if (/\bimage\b/i.test(task)) return "AI IMAGE";
  if (/\blesson\b/i.test(task)) return "LESSON";
  if (/\b(source|upload|document)\b/i.test(task)) return "STORAGE";
  if (/\b(save|database|checkpoint)\b/i.test(task)) return "DATABASE";
  if (/\b(course|outline)\b/i.test(task)) return "COURSE";
  return "PROGRESS";
}

function progressKey(event: GenerationProgressEvent) {
  return [event.courseId, event.jobId, event.sessionId, event.task].join("|");
}

function displayProgressId(id: string | undefined) {
  return shortGenerationId(id);
}

function updateGenerationTime(event: GenerationProgressEvent, at: Date) {
  const id = event.sessionId ?? event.jobId ?? event.courseId;
  if (!id) return;
  const now = at.getTime();
  const state = generationTimes.get(id);
  if (!state || event.status === "STARTED") {
    generationTimes.set(id, { startedAt: now, lastAt: now, waitingMs: 0, waiting: event.status === "WAITING" });
    return;
  }
  if (state.waiting && event.status !== "WAITING") {
    state.waitingMs += Math.max(0, now - state.lastAt);
    state.waiting = false;
    state.lastAt = now;
  } else if (!state.waiting && event.status === "WAITING") {
    state.waiting = true;
    state.lastAt = now;
  } else if (!state.waiting) state.lastAt = now;
  generationTimes.delete(id);
  generationTimes.set(id, state);
  if (generationTimes.size > 500) generationTimes.delete(generationTimes.keys().next().value as string);
}

export function generationTimeSummary(id: string, fallbackStartedAt?: number) {
  const state = generationTimes.get(id);
  const now = Date.now();
  if (!state) return {
    activeProcessingMs: null as number | null,
    userWaitingMs: null as number | null,
    totalElapsedMs: fallbackStartedAt === undefined ? null : Math.max(0, now - fallbackStartedAt),
  };
  const userWaitingMs = state.waitingMs + (state.waiting ? Math.max(0, now - state.lastAt) : 0);
  const totalElapsedMs = Math.max(0, now - (fallbackStartedAt === undefined ? state.startedAt : Math.min(state.startedAt, fallbackStartedAt)));
  return {
    activeProcessingMs: Math.max(0, totalElapsedMs - userWaitingMs),
    userWaitingMs,
    totalElapsedMs,
  };
}

export function generationImageCount(id: string) {
  return generationImageCounts.get(id) ?? null;
}

export function logGenerationProgress(event: GenerationProgressEvent) {
  const at = event.at ?? new Date();
  const task = safeText(event.task) || "Generation task";
  const key = progressKey({ ...event, task });
  const fingerprint = JSON.stringify({
    status: event.status,
    category: event.category,
    task,
    courseId: event.courseId,
    jobId: event.jobId,
    sessionId: event.sessionId,
    current: event.current,
    total: event.total,
    completedLessons: event.completedLessons,
    progressPercent: event.progressPercent,
    generatedImageCount: event.generatedImageCount,
    detail: event.detail,
  });
  if (event.status !== "STARTED" && recentProgress.get(key) === fingerprint) return;
  updateGenerationTime(event, at);
  if (event.status === "STARTED") {
    if (event.courseId) generationImageCounts.set(event.courseId, 0);
    for (const previousKey of recentProgress.keys()) {
      if (previousKey.startsWith(`${event.courseId}|`)) recentProgress.delete(previousKey);
    }
  }
  const imageCountKey = event.sessionId ?? event.jobId ?? event.courseId;
  if (imageCountKey && event.generatedImageCount !== undefined) {
    generationImageCounts.set(imageCountKey, event.generatedImageCount);
    if (generationImageCounts.size > 500) generationImageCounts.delete(generationImageCounts.keys().next().value as string);
  }
  recentProgress.delete(key);
  recentProgress.set(key, fingerprint);
  if (recentProgress.size > maxRecentProgress)
    recentProgress.delete(recentProgress.keys().next().value as string);

  const level: ConsoleLevel = event.status === "FAILED" ? "ERROR"
    : event.status === "DONE" ? "SUCCESS"
      : event.status === "SKIPPED" ? "WARNING"
        : event.status === "IN PROGRESS" ? "PROGRESS" : "INFO";
  const tone: ConsoleLevel = event.status === "WAITING" ? "WARNING" : level;
  const indicator = event.status === "WAITING" ? "…" : event.status === "CANCELLED" ? "⊘" : undefined;
  const fields: Record<string, unknown> = {
    status: event.status,
    ...(Number.isFinite(event.current) && Number.isFinite(event.total)
      ? { [event.category === "LESSON" || /\blesson\b/i.test(task) ? "lesson" : "step"]: `${event.current}/${event.total}` }
      : {}),
    ...(event.completedLessons === undefined ? {} : { completed: event.completedLessons }),
    ...(event.progressPercent === undefined ? {} : { progress: `${event.progressPercent}%` }),
    ...(event.generatedImageCount === undefined ? {} : { images: event.generatedImageCount }),
    ...(event.durationMs === undefined ? {} : { duration: `${(event.durationMs / 1_000).toFixed(1)}s` }),
    ...(displayProgressId(event.courseId) ? { course: displayProgressId(event.courseId) } : {}),
    ...(displayProgressId(event.jobId) ? { job: displayProgressId(event.jobId) } : {}),
    ...(displayProgressId(event.sessionId) ? { session: displayProgressId(event.sessionId) } : {}),
    ...(event.detail ? { detail: safeText(event.detail) } : {}),
  };
  writeGenerationLog(level, event.category ?? categoryFor(task), task, {
    ...fields,
    courseId: event.courseId,
    jobId: event.jobId,
    sessionId: event.sessionId,
  }, console.log, undefined, at, { tone, indicator, sessionSeparator: event.status === "STARTED" });
}

function readableValue(value: number | null, format: "count" | "money" | "duration" = "count") {
  if (value === null || !Number.isFinite(value)) return "Unavailable";
  if (format === "money") return `$${value.toFixed(8)}`;
  if (format === "duration") {
    const seconds = Math.floor(value / 1_000);
    return seconds >= 60
      ? `${Math.floor(seconds / 60)}m ${(seconds % 60).toString().padStart(2, "0")}s`
      : `${(value / 1_000).toFixed(1)}s`;
  }
  return Math.round(value).toLocaleString("en-US");
}

export function logGenerationSummary(summary: GenerationSummary) {
  const id = shortGenerationId(summary.courseId) ?? "unavailable";
  const sections: GenerationLogSection[] = [
    { title: "Course", fields: { title: safeText(summary.courseTitle ?? "Untitled course"), courseId: id } },
    { title: "Output", fields: { lessons: readableValue(summary.totalLessons), generatedImages: readableValue(summary.generatedImages) } },
    { title: "AI activity", fields: {
      requests: readableValue(summary.totalAiRequests),
      failedApiRequests: readableValue(summary.failedRequests),
      retries: readableValue(summary.retries),
    } },
    { title: "Token usage", fields: {
      inputTokens: readableValue(summary.inputTokens),
      cachedInputTokens: readableValue(summary.cachedInputTokens),
      uncachedInputTokens: readableValue(summary.uncachedInputTokens),
      cacheWriteTokens: readableValue(summary.cacheWriteTokens),
      outputTokens: readableValue(summary.outputTokens),
      reasoningTokens: readableValue(summary.reasoningTokens),
      recordedTextTokens: readableValue(summary.recordedTextTokens),
      imageTextInputTokens: readableValue(summary.imageTextInputTokens),
      cachedImageTextInputTokens: readableValue(summary.cachedImageTextInputTokens),
      imageInputTokens: readableValue(summary.imageInputTokens),
      cachedImageInputTokens: readableValue(summary.cachedImageInputTokens),
      imageTextOutputTokens: readableValue(summary.imageTextOutputTokens),
      imageOutputTokens: readableValue(summary.imageOutputTokens),
      recordedImageTokens: readableValue(summary.recordedImageTokens ?? summary.imageTokens),
      imageTotalTokens: readableValue(summary.imageTotalTokens),
      totalTokens: readableValue(summary.totalTokens),
      completeness: summary.usageCompleteness,
    } },
    { title: "Cache", fields: {
      hitPercent: summary.cacheHitPercent === null ? "Unavailable" : `${summary.cacheHitPercent.toFixed(1)}%`,
      imageToolHitPercent: summary.imageCacheHitPercent === null ? "Unavailable" : `${summary.imageCacheHitPercent.toFixed(1)}%`,
      estimatedSavings: readableValue(summary.estimatedCacheSavingsUsd, "money"),
    } },
    { title: `Generation cost (USD; text estimated; image ${summary.imageGenerationCostStatus})`, fields: {
      text: readableValue(summary.textGenerationCostUsd, "money"),
      image: readableValue(summary.imageGenerationCostUsd, "money"),
      combined: readableValue(summary.combinedGenerationCostUsd, "money"),
    } },
    { title: "Time", fields: {
      activeProcessing: readableValue(summary.activeProcessingMs, "duration"),
      userWaiting: readableValue(summary.userWaitingMs, "duration"),
      totalElapsed: readableValue(summary.totalElapsedMs, "duration"),
    } },
    { title: "Result", fields: { finalStatus: summary.finalStatus } },
  ];
  if (summary.sessionId || summary.jobId) {
    sections.splice(1, 0, {
      title: "Run",
      fields: { ...(summary.sessionId ? { sessionId: summary.sessionId } : {}), ...(summary.jobId ? { jobId: summary.jobId } : {}) },
    });
  }
  writeGenerationLog(
    summary.finalStatus === "FAILED" ? "ERROR" : summary.finalStatus === "CANCELLED" ? "WARNING" : "SUCCESS",
    "SUMMARY",
    "Course generation summary",
    {
      courseId: summary.courseId,
      sessionId: summary.sessionId,
      jobId: summary.jobId,
      summary: {
        ...summary,
        courseTitle: safeText(summary.courseTitle ?? "Untitled course"),
      },
    },
    console.info,
    undefined,
    undefined,
    {
      layout: "multiline",
      tone: summary.finalStatus === "FAILED" ? "ERROR" : summary.finalStatus === "CANCELLED" ? "WARNING" : "SUCCESS",
      sections,
      sessionSeparator: true,
    },
  );
}
