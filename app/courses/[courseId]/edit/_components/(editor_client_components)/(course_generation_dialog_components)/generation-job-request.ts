import type { SourceGenerationJobSnapshot } from "@/lib/ai/course-generation-schemas";

export class GenerationJobRequestError extends Error {
  constructor(public status: number, message: string) { super(message); this.name = "GenerationJobRequestError"; }
}

export function isMissingGenerationJob(error: unknown) {
  return error instanceof GenerationJobRequestError &&
    ((error.status === 404 && error.message === "Generation job was not found.") ||
      (error.status === 400 && error.message === "Invalid generation job identifier."));
}

export async function responseError(response: Response) {
  try {
    const body = await response.json() as { error?: unknown };
    if (typeof body.error === "string") return body.error;
  } catch { /* Use the stable fallback for responses without JSON. */ }
  return "Course generation failed. Please try again.";
}

export async function postSourceGenerationAction(courseId: string, action: "advanceGeneration" | "getGeneration" | "cancelGeneration" | "generate", jobId: string, body?: FormData, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const formData = body ?? new FormData();
  formData.set("action", action);
  formData.set("jobId", jobId);
  const response = await fetch(`/api/courses/${courseId}/generate`, { method: "POST", body: formData, signal });
  signal?.throwIfAborted();
  if (!response.ok) throw new GenerationJobRequestError(response.status, await responseError(response));
  const result = await response.json() as SourceGenerationJobSnapshot;
  signal?.throwIfAborted();
  return result;
}

export async function advanceSourceGenerationJobUntil(courseId: string, jobId: string, stopStatuses: string[], onProgress: (job: SourceGenerationJobSnapshot) => void, signal?: AbortSignal) {
  let job = await postSourceGenerationAction(courseId, "getGeneration", jobId, undefined, signal);
  onProgress(job);
  let workCount = 0;
  while (!stopStatuses.includes(job.status)) {
    signal?.throwIfAborted();
    if (job.status === "failed" || job.status === "cancelled") throw new Error(job.errorMessage || "Course generation stopped. Retry this stage to continue.");
    if (workCount >= 1_000) throw new Error("Course generation exceeded its work-unit limit. Retry the job.");
    job = await postSourceGenerationAction(courseId, "advanceGeneration", jobId, undefined, signal);
    onProgress(job);
    workCount += 1;
  }
  return job;
}
