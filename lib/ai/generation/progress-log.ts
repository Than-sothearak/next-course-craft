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
  courseId?: string;
  jobId?: string;
  sessionId?: string;
  current?: number;
  total?: number;
  detail?: string;
  at?: Date;
};

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});

function readableField(value: string | undefined) {
  return value?.replace(/[\r\n\t]+/g, " ").trim().slice(0, 160);
}

export function logGenerationProgress(event: GenerationProgressEvent) {
  const parts = [
    dateTimeFormatter.format(event.at ?? new Date()),
    "COURSE GENERATION",
    event.status,
    readableField(event.task) ?? "Generation task",
  ];
  if (Number.isFinite(event.current) && Number.isFinite(event.total))
    parts.push(`Progress: ${event.current}/${event.total}`);
  const courseId = readableField(event.courseId);
  const jobId = readableField(event.jobId);
  const sessionId = readableField(event.sessionId);
  const detail = readableField(event.detail);
  if (courseId) parts.push(`Course: ${courseId}`);
  if (jobId) parts.push(`Job: ${jobId}`);
  if (sessionId) parts.push(`Session: ${sessionId}`);
  if (detail) parts.push(detail);
  console.log(`[${parts.join("] [")}]`);
}
