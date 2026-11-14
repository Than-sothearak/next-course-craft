/** @vitest-environment jsdom */
import { act, useEffect, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { useCourseGenerationSession } from "@/app/courses/[courseId]/edit/_components/_components/use-course-generation-session";
import { sessionRequest } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/generation-session-request";
import type { CourseGenerationWizard } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/course-generation-wizard";
import { courseGenerationInputSchema } from "@/lib/ai/course-generation-schemas";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import type { GenerationSessionSnapshot } from "@/lib/ai/course-generation-session-schema";
vi.mock("@/app/courses/[courseId]/edit/_components/(editor_client_components)/generation-session-request", async (original) => ({ ...await original<typeof import("@/app/courses/[courseId]/edit/_components/(editor_client_components)/generation-session-request")>(), sessionRequest: vi.fn() }));
const input = courseGenerationInputSchema.parse({ prompt: "Teach HTML", audience: "Students", level: "beginner", lessonCount: 2, template: "custom", includeImages: false, courseTitle: "", courseDescription: "" });
const state: GenerationSessionSnapshot = { id: "session", status: "generating", input, error: null, currentLessonId: "lesson-0", completedLessonIds: [], readyToSave: false, outline: { title: "Course", description: "Learn HTML", sections: [{ id: "learn", title: "Learn", lessons: [0, 1].map((index) => ({ id: `lesson-${index}`, title: `Lesson ${index + 1}`, objective: "Explain HTML", kind: "learn" })) }] } };
const editor = editorSnapshotSchema.parse({ title: "Course", description: "Learn HTML", revision: 1, sections: [{ id: "learn", title: "Learn", order: 0 }], lessons: [] });
const mutation: ComponentProps<typeof CourseGenerationWizard>["runServerMutation"] = (operation) => operation(1);
let hook: ReturnType<typeof useCourseGenerationSession>, root: Root, container: HTMLDivElement;
const cancelledLessonsRemoved = vi.fn(async () => undefined);
function Harness() { const value = useCourseGenerationSession("course", mutation, true, cancelledLessonsRemoved); useEffect(() => { hook = value; }); return null; }
beforeEach(() => { window.localStorage.clear(); vi.clearAllMocks(); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(editor)))); container = document.createElement("div"); document.body.append(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("lesson generation coordinator", () => {
  const busy = { ...state, completedLessonIds: ["lesson-0"], currentLessonId: "lesson-1", lease: { locked: true, retryAfterMs: 2_000 } };
  const completed = { ...state, status: "completed" as const, completedLessonIds: ["lesson-0", "lesson-1"], currentLessonId: null };
  it("polls a restored active lock without submitting generation, then saves its checkpoint when the lock is free", async () => {
    vi.useFakeTimers();
    let latest = busy;
    const actions: string[] = [];
    vi.mocked(sessionRequest).mockImplementation(async (_courseId, body) => {
      if (!body) return latest;
      actions.push((body as { action: string }).action);
      return { editor, session: completed };
    });
    await act(async () => root.render(<Harness />));
    expect(actions).toEqual([]);
    await act(async () => vi.advanceTimersByTimeAsync(6_000));
    expect(actions).toEqual([]);
    expect(hook.session!.completedLessonIds).toEqual(["lesson-0"]);
    latest = { ...busy, readyToSave: true, lease: { locked: false, retryAfterMs: 0 } };
    await act(async () => vi.advanceTimersByTimeAsync(2_000));
    expect(actions).toEqual(["commit"]);
    expect(hook.session!.status).toBe("completed");
    expect(hook.error).toBe("");
  });
  it("switches a busy prepare response to GET polling and adopts lessons completed by the original request", async () => {
    vi.useFakeTimers();
    let latest: GenerationSessionSnapshot = state;
    const actions: string[] = [];
    vi.mocked(sessionRequest).mockImplementation(async (_courseId, body) => {
      if (!body) return latest;
      actions.push((body as { action: string }).action);
      latest = busy;
      return busy;
    });
    await act(async () => root.render(<Harness />));
    expect(actions).toEqual(["prepare"]);
    await act(async () => vi.advanceTimersByTimeAsync(4_000));
    expect(actions).toEqual(["prepare"]);
    latest = completed;
    await act(async () => vi.advanceTimersByTimeAsync(2_000));
    expect(hook.session!.completedLessonIds).toHaveLength(2);
    expect(hook.running).toBe(false);
    expect(actions).toEqual(["prepare"]);
    // Initial synchronization and the original request's completed save.
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("waits after a busy commit instead of counting an unsaved lesson or resubmitting it", async () => {
    vi.useFakeTimers();
    let latest: GenerationSessionSnapshot = { ...busy, readyToSave: true, lease: { locked: false, retryAfterMs: 0 } };
    let commits = 0;
    vi.mocked(sessionRequest).mockImplementation(async (_courseId, body) => {
      if (!body) return latest;
      commits += 1;
      latest = commits === 1 ? { ...busy, readyToSave: true } : completed;
      return { editor, session: latest };
    });
    await act(async () => root.render(<Harness />));
    await act(async () => vi.advanceTimersByTimeAsync(4_000));
    expect(commits).toBe(1);
    expect(hook.session!.completedLessonIds).toHaveLength(1);
    latest = { ...busy, readyToSave: true, lease: { locked: false, retryAfterMs: 0 } };
    await act(async () => vi.advanceTimersByTimeAsync(2_000));
    expect(commits).toBe(2);
    expect(hook.session!.completedLessonIds).toHaveLength(2);
  });
  it("stops polling when unmounted and does not send a delayed generation request", async () => {
    vi.useFakeTimers();
    vi.mocked(sessionRequest).mockResolvedValue(busy);
    await act(async () => root.render(<Harness />));
    const calls = vi.mocked(sessionRequest).mock.calls.length;
    await act(async () => root.render(null));
    await act(async () => vi.advanceTimersByTimeAsync(10_000));
    expect(sessionRequest).toHaveBeenCalledTimes(calls);
  });
  it("keeps a provider failure paused once an existing request releases its lock", async () => {
    vi.useFakeTimers();
    let latest: GenerationSessionSnapshot = busy;
    vi.mocked(sessionRequest).mockImplementation(async () => latest);
    await act(async () => root.render(<Harness />));
    latest = { ...busy, lease: { locked: false, retryAfterMs: 0 }, error: "Provider unavailable" };
    await act(async () => vi.advanceTimersByTimeAsync(2_000));
    expect(hook.error).toBe("Provider unavailable");
    expect(hook.running).toBe(false);
    expect(vi.mocked(sessionRequest).mock.calls.every((call) => !call[1])).toBe(true);
  });
  it("adopts a completed session discovered during startup synchronization", async () => {
    vi.mocked(sessionRequest).mockResolvedValueOnce(state).mockResolvedValue(completed);
    await act(async () => root.render(<Harness />));
    expect(hook.session!.status).toBe("completed");
    expect(vi.mocked(sessionRequest).mock.calls.every((call) => !call[1])).toBe(true);
  });
  function wouldWarnBeforeLeaving() {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  }
  it("warns before refresh during generation even with the progress panel closed, and cleans up on unmount", async () => {
    vi.mocked(sessionRequest).mockResolvedValue({ ...state, error: "Retry needed" });
    expect(wouldWarnBeforeLeaving()).toBe(false);
    await act(async () => root.render(<Harness />));
    expect(wouldWarnBeforeLeaving()).toBe(true);
    await act(async () => hook.dismissProgress());
    expect(wouldWarnBeforeLeaving()).toBe(true);
    await act(async () => root.render(null));
    expect(wouldWarnBeforeLeaving()).toBe(false);
  });
  it.each(["completed", "cancelled"] as const)("removes the refresh warning when generation is %s", async (status) => {
    vi.mocked(sessionRequest).mockResolvedValue({ ...state, error: "Retry needed" });
    await act(async () => root.render(<Harness />));
    expect(wouldWarnBeforeLeaving()).toBe(true);
    if (status === "cancelled") {
      vi.mocked(sessionRequest).mockResolvedValue({ session: { ...state, status }, removedLessonIds: [], changed: false });
      await act(async () => hook.cancel());
    } else {
      await act(async () => hook.setSession({ ...state, status }));
    }
    expect(wouldWarnBeforeLeaving()).toBe(false);
  });
  it("synchronizes the editor after cancelled placeholders are removed", async () => {
    vi.mocked(sessionRequest).mockImplementation(async (_courseId, body) => body
      ? { session: { ...state, status: "cancelled" }, removedLessonIds: ["lesson-1"], changed: true }
      : state);
    await act(async () => root.render(<Harness />));
    await act(async () => hook.cancel());
    expect(cancelledLessonsRemoved).toHaveBeenCalledExactlyOnceWith(["lesson-1"], true);
    expect(hook.session!.status).toBe("cancelled");
  });
  it("waits for each database save before starting the next lesson", async () => {
    const actions: string[] = [];
    let latest = state;
    let finishSave!: (value: unknown) => void;
    vi.mocked(sessionRequest).mockImplementation(async (_courseId, body) => {
      if (!body) return latest;
      const action = (body as { action: string }).action; actions.push(action);
      if (action === "prepare") return { ...latest, readyToSave: true };
      return new Promise((resolve) => { finishSave = resolve; });
    });
    await act(async () => root.render(<Harness />));
    expect(actions).toEqual(["prepare", "commit"]); expect(hook.session!.completedLessonIds).toEqual([]);
    expect(wouldWarnBeforeLeaving()).toBe(true);
    latest = { ...state, completedLessonIds: ["lesson-0"], currentLessonId: "lesson-1" };
    await act(async () => finishSave({ editor, session: latest }));
    expect(hook.session!.completedLessonIds).toEqual(["lesson-0"]);
    expect(actions).toEqual(["prepare", "commit", "prepare", "commit"]);
    await act(async () => finishSave({ editor, session: { ...state, status: "completed", completedLessonIds: ["lesson-0", "lesson-1"], currentLessonId: null } }));
    expect(hook.session!.status).toBe("completed"); expect(hook.running).toBe(false);
    expect(hook.progressVisible).toBe(true);
    expect(wouldWarnBeforeLeaving()).toBe(false);
  });
  it("restores an interrupted job from the next unsaved lesson", async () => {
    const restored = { ...state, completedLessonIds: ["lesson-0"], currentLessonId: "lesson-1", readyToSave: true };
    const actions: string[] = [];
    vi.mocked(sessionRequest).mockImplementation(async (_courseId, body) => {
      if (!body) return restored;
      actions.push((body as { action: string }).action);
      return { editor, session: { ...restored, status: "completed", completedLessonIds: ["lesson-0", "lesson-1"], currentLessonId: null } };
    });
    await act(async () => root.render(<Harness />));
    expect(actions).toEqual(["commit"]); expect(hook.session!.completedLessonIds).toHaveLength(2);
  });
  it("keeps provider failures paused after refresh until the author retries", async () => {
    vi.mocked(sessionRequest).mockResolvedValue({ ...state, error: "Billing unavailable" });
    await act(async () => root.render(<Harness />));
    expect(hook.error).toBe("Billing unavailable");
    expect(vi.mocked(sessionRequest).mock.calls.every((call) => !call[1])).toBe(true);
  });
  it.each(["completed", "cancelled"] as const)("does not reopen a %s run when visiting the editor later", async (status) => {
    vi.mocked(sessionRequest).mockResolvedValue({ ...state, status });
    await act(async () => root.render(<Harness />));
    expect(hook.session!.status).toBe(status);
    expect(hook.progressVisible).toBe(false);
    expect(vi.mocked(sessionRequest).mock.calls.every((call) => !call[1])).toBe(true);
  });
  it("closes the popup without cancelling generation and remembers dismissal for the job", async () => {
    vi.mocked(sessionRequest).mockResolvedValue({ ...state, error: "Retry needed" });
    await act(async () => root.render(<Harness />));
    expect(hook.progressVisible).toBe(true);
    await act(async () => hook.dismissProgress());
    expect(hook.progressVisible).toBe(false);
    expect(window.localStorage.getItem("course-generation-progress-dismissed:course:session")).toBe("true");
    await act(async () => hook.showProgress());
    expect(hook.progressVisible).toBe(true);
    expect(window.localStorage.getItem("course-generation-progress-dismissed:course:session")).toBeNull();
    await act(async () => hook.dismissProgress());
    expect(vi.mocked(sessionRequest).mock.calls.every((call) => !call[1])).toBe(true);
    await act(async () => hook.setSession({ ...state, id: "new-run" }));
    expect(hook.progressVisible).toBe(true);
  });
  it("keeps a dismissed active job hidden when the editor is reopened", async () => {
    window.localStorage.setItem("course-generation-progress-dismissed:course:session", "true");
    vi.mocked(sessionRequest).mockResolvedValue({ ...state, error: "Retry needed" });
    await act(async () => root.render(<Harness />));
    expect(hook.progressVisible).toBe(false);
    expect(hook.session!.id).toBe("session");
  });

});
