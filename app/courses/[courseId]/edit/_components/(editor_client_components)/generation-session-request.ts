import type { GenerationSessionSnapshot } from "@/lib/ai/course-generation-session-schema";
import type { EditorSnapshotInput } from "@/lib/editor/schemas";
export type SavedSessionResponse = { session: GenerationSessionSnapshot; editor: EditorSnapshotInput };
export class SessionRequestError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function sessionRequest<T = GenerationSessionSnapshot>(courseId: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/courses/${courseId}/generation-session`, {
    method: body ? "POST" : "GET", cache: "no-store", signal,
    ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok) throw new SessionRequestError(data.error ?? "Course generation could not continue.", response.status);
  return data;
}
