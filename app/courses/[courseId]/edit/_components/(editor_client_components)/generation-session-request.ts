import type { GenerationSessionSnapshot } from "@/lib/ai/course-generation-session-schema";
import type { EditorSnapshotInput } from "@/lib/editor/schemas";
import { readResponseJson } from "@/lib/http/read-response-json";
export type SavedSessionResponse = { session: GenerationSessionSnapshot; editor: EditorSnapshotInput };
export class SessionRequestError extends Error {
  constructor(message: string, public status: number) { super(message); this.name = "SessionRequestError"; }
}
export async function sessionRequest<T = GenerationSessionSnapshot>(courseId: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/courses/${courseId}/generation-session`, {
    method: body ? "POST" : "GET", cache: "no-store", signal,
    ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
  });
  const data = await readResponseJson<{ error?: string } & Record<string, unknown>>(response);
  if (!response.ok) throw new SessionRequestError(data?.error ?? `Course generation request failed (${response.status}).`, response.status);
  if (data === undefined) throw new SessionRequestError("The generation server returned an empty response. Retry the action.", response.ok ? 502 : response.status);
  return data as T;
}
