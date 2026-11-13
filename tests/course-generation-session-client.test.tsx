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
function Harness() { const value = useCourseGenerationSession("course", mutation); useEffect(() => { hook = value; }); return null; }
beforeEach(() => { window.localStorage.clear(); vi.clearAllMocks(); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(editor)))); container = document.createElement("div"); document.body.append(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

describe("lesson generation coordinator", () => {
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
    latest = { ...state, completedLessonIds: ["lesson-0"], currentLessonId: "lesson-1" };
    await act(async () => finishSave({ editor, session: latest }));
    expect(hook.session!.completedLessonIds).toEqual(["lesson-0"]);
    expect(actions).toEqual(["prepare", "commit", "prepare", "commit"]);
    await act(async () => finishSave({ editor, session: { ...state, status: "completed", completedLessonIds: ["lesson-0", "lesson-1"], currentLessonId: null } }));
    expect(hook.session!.status).toBe("completed"); expect(hook.running).toBe(false);
    expect(hook.progressVisible).toBe(true);
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
