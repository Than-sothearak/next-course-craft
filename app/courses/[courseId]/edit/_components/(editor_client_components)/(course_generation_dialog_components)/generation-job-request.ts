import type { SourceGenerationJobSnapshot } from "@/lib/ai/course-generation-schemas";

export class GenerationJobRequestError extends Error {
  constructor(public status: number, message: string) { super(message); this.name = "GenerationJobRequestError"; }
}

const generationLeaseConflictMessage = "Generation is already running or this course changed. Try again shortly.";

export type GenerationLeaseWaitOptions = {
  onWaiting?: () => void;
  onAvailable?: () => void;
  shouldStop?: () => boolean;
};

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

async function waitForGenerationLease(courseId: string, signal: AbortSignal | undefined, options: GenerationLeaseWaitOptions) {
  while (true) {
    signal?.throwIfAborted();
    if (options.shouldStop?.()) return false;

    const formData = new FormData();
    formData.set("action", "getGenerationLease");
    const response = await fetch(`/api/courses/${courseId}/generate`, { method: "POST", body: formData, signal });
    signal?.throwIfAborted();
    if (!response.ok) throw new GenerationJobRequestError(response.status, await responseError(response));

    const status = await response.json() as { locked: boolean; retryAfterMs: number };
    if (!status.locked) return true;

    options.onWaiting?.();
    await new Promise((resolve) => setTimeout(resolve, status.retryAfterMs));
  }
}

export async function postCourseGenerationForm(courseId: string, formData: FormData, signal?: AbortSignal, waitOptions: GenerationLeaseWaitOptions = {}) {
  while (true) {
    signal?.throwIfAborted();
    if (waitOptions.shouldStop?.()) throw new Error("Generation wait was cancelled.");

    const response = await fetch(`/api/courses/${courseId}/generate`, { method: "POST", body: formData, signal });
    signal?.throwIfAborted();
    if (response.status !== 409 || await responseError(response.clone()) !== generationLeaseConflictMessage) return response;

    waitOptions.onWaiting?.();
    if (!await waitForGenerationLease(courseId, signal, waitOptions)) throw new Error("Generation wait was cancelled.");
    waitOptions.onAvailable?.();
  }
}

export async function postSourceGenerationAction(courseId: string, action: "advanceGeneration" | "getGeneration" | "cancelGeneration" | "generate", jobId: string, body?: FormData, signal?: AbortSignal, waitOptions: GenerationLeaseWaitOptions = {}) {
  signal?.throwIfAborted();
  const formData = body ?? new FormData();
  formData.set("action", action);
  formData.set("jobId", jobId);
  const response = ["advanceGeneration", "generate"].includes(action)
    ? await postCourseGenerationForm(courseId, formData, signal, waitOptions)
    : await fetch(`/api/courses/${courseId}/generate`, { method: "POST", body: formData, signal });
  signal?.throwIfAborted();
  if (!response.ok) throw new GenerationJobRequestError(response.status, await responseError(response));
  const result = await response.json() as SourceGenerationJobSnapshot;
  signal?.throwIfAborted();
  return result;
}

export async function advanceSourceGenerationJobUntil(courseId: string, jobId: string, stopStatuses: string[], onProgress: (job: SourceGenerationJobSnapshot) => void, signal?: AbortSignal, waitOptions: GenerationLeaseWaitOptions = {}) {
  let job = await postSourceGenerationAction(courseId, "getGeneration", jobId, undefined, signal, waitOptions);
  onProgress(job);
  let workCount = 0;
  while (!stopStatuses.includes(job.status)) {
    signal?.throwIfAborted();
    if (job.status === "failed" || job.status === "cancelled") throw new Error(job.errorMessage || "Course generation stopped. Retry this stage to continue.");
    if (workCount >= 1_000) throw new Error("Course generation exceeded its work-unit limit. Retry the job.");
    job = await postSourceGenerationAction(courseId, "advanceGeneration", jobId, undefined, signal, waitOptions);
    onProgress(job);
    workCount += 1;
  }
  return job;
}
