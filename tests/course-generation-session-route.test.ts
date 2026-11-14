import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/courses/[courseId]/generation-session/route";
import { resolveCourseAccess } from "@/lib/workspaces/access";
import { requireAIEnabled } from "@/lib/auth/authorization";
import { acquireGenerationLease, getGenerationLeaseStatus, GenerationLeaseBusyError, releaseGenerationLease } from "@/lib/ai/generation-lease";
import { getCourseEditor } from "@/lib/editor/services/course";
import { courseGenerationInputSchema } from "@/lib/ai/course-generation-schemas";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { slideMasterSchema } from "@/lib/editor/slide-design";
import type { GenerationSessionSnapshot } from "@/lib/ai/course-generation-session-schema";
import { getSession, prepareNextLesson, commitNextLesson, cancelSession, cleanupCancelledSessionLessons } from "@/lib/ai/generation/session-workflow";
import { DashboardError } from "@/lib/dashboard/rules";
const cache = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => cache);
vi.mock("@/lib/dashboard/http", async (original) => ({ ...await original<typeof import("@/lib/dashboard/http")>(), requireOwnerId: vi.fn(async () => "user") }));
vi.mock("@/lib/db/mongodb", () => ({ connectToDatabase: vi.fn() }));
vi.mock("@/lib/workspaces/access", () => ({ resolveCourseAccess: vi.fn(async () => ({ ownerId: "owner" })) }));
vi.mock("@/lib/auth/authorization", () => ({ requireAIEnabled: vi.fn() }));
vi.mock("@/lib/ai/generation-lease", async (original) => ({ ...await original<typeof import("@/lib/ai/generation-lease")>(), acquireGenerationLease: vi.fn(async () => ({ courseId: "course", token: "token" })), getGenerationLeaseStatus: vi.fn(), releaseGenerationLease: vi.fn(async () => undefined) }));
vi.mock("@/lib/editor/services/course", () => ({ getCourseEditor: vi.fn() }));
vi.mock("@/lib/ai/generation/session-workflow", () => ({ getSession: vi.fn(), planSession: vi.fn(), approveSession: vi.fn(), prepareNextLesson: vi.fn(), commitNextLesson: vi.fn(), cancelSession: vi.fn(), cleanupCancelledSessionLessons: vi.fn() }));
const context = { params: Promise.resolve({ courseId: "course" }) };
const sessionId = "507f1f77bcf86cd799439013";
const session: GenerationSessionSnapshot = { id: sessionId, status: "generating", input: courseGenerationInputSchema.parse({ prompt: "Teach HTML", audience: "Students", level: "beginner", lessonCount: 2, template: "custom", includeImages: false, courseTitle: "", courseDescription: "" }), outline: { title: "Course", description: "Teach HTML", sections: [{ id: "learn", title: "Learn", lessons: [{ id: "lesson", title: "HTML", objective: "Learn HTML", kind: "learn" }] }] }, completedLessonIds: [], currentLessonId: "lesson", error: null, readyToSave: false };
const submit = (body: unknown, origin = "http://localhost") => POST(new NextRequest("http://localhost/api/courses/course/generation-session", { method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify(body) }), context);
beforeEach(() => { vi.clearAllMocks(); vi.mocked(acquireGenerationLease).mockReset().mockResolvedValue({ courseId: "course", token: "00000000-0000-0000-0000-000000000000" }); vi.mocked(getGenerationLeaseStatus).mockResolvedValue({ locked: false, retryAfterMs: 0 }); vi.mocked(resolveCourseAccess).mockResolvedValue({ ownerId: "owner" } as Awaited<ReturnType<typeof resolveCourseAccess>>); vi.mocked(cleanupCancelledSessionLessons).mockResolvedValue({ session: null, discardedLessonIds: [], changed: false }); });
describe("generation session authorization and mutations", () => {
  it("includes lock status in progress reads so restored clients can wait without POST retries", async () => {
    vi.mocked(getSession).mockResolvedValue(session);
    vi.mocked(getGenerationLeaseStatus).mockResolvedValue({ locked: true, retryAfterMs: 2_000 });
    const response = await GET(new NextRequest("http://localhost/api/courses/course/generation-session"), context);
    expect(await response.json()).toMatchObject({ id: sessionId, completedLessonIds: [], lease: { locked: true, retryAfterMs: 2_000 } });
    expect(acquireGenerationLease).not.toHaveBeenCalled();
  });
  it.each(["prepare", "commit"] as const)("returns accepted progress when another request holds the lock during %s", async (action) => {
    vi.mocked(acquireGenerationLease).mockRejectedValueOnce(new GenerationLeaseBusyError());
    vi.mocked(getSession).mockResolvedValue(session);
    vi.mocked(getGenerationLeaseStatus).mockResolvedValue({ locked: true, retryAfterMs: 2_000 });
    const editor = editorSnapshotSchema.parse({ title: "Course", description: "", revision: 1, sections: [{ id: "learn", title: "Learn", order: 0 }], lessons: [] });
    vi.mocked(getCourseEditor).mockResolvedValue({ ...editor, courseId: "course", descriptionHtml: editor.descriptionHtml, courseLayout: "standard", slideMaster: slideMasterSchema.parse({}) } as Awaited<ReturnType<typeof getCourseEditor>>);
    const response = await submit({ action, sessionId, ...(action === "commit" ? { revision: 1 } : {}) });
    expect(response.status).toBe(202);
    expect(response.headers.get("Retry-After")).toBe("2");
    expect(await response.json()).toMatchObject(action === "commit" ? { editor, session: { id: sessionId, completedLessonIds: [], lease: { locked: true } } } : { id: sessionId, completedLessonIds: [], lease: { locked: true } });
    expect(prepareNextLesson).not.toHaveBeenCalled(); expect(commitNextLesson).not.toHaveBeenCalled();
    expect(releaseGenerationLease).not.toHaveBeenCalled();
  });
  it("keeps genuine course revision conflicts as errors", async () => {
    vi.mocked(commitNextLesson).mockRejectedValueOnce(new DashboardError("The course changed. Reload before continuing generation.", 409));
    const response = await submit({ action: "commit", sessionId, revision: 1 });
    expect(response.status).toBe(409);
    expect(releaseGenerationLease).toHaveBeenCalledOnce();
  });
  it("reads progress with current course permissions and no generation side effects", async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    const response = await GET(new NextRequest("http://localhost/api/courses/course/generation-session"), context);
    expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(resolveCourseAccess).toHaveBeenCalledWith("user", "course", "courses.edit");
    expect(acquireGenerationLease).not.toHaveBeenCalled(); expect(prepareNextLesson).not.toHaveBeenCalled();
  });
  it("requires AI permission and takes the course lease before generating one lesson", async () => {
    vi.mocked(prepareNextLesson).mockResolvedValue(null);
    expect((await submit({ action: "prepare", sessionId })).status).toBe(200);
    expect(resolveCourseAccess).toHaveBeenCalledWith("user", "course", "ai.generate");
    expect(requireAIEnabled).toHaveBeenCalledOnce(); expect(acquireGenerationLease).toHaveBeenCalledOnce();
    expect(prepareNextLesson).toHaveBeenCalledWith({ ownerId: "owner", courseId: "course" }, sessionId);
    expect(releaseGenerationLease).toHaveBeenCalledOnce();
  });
  it("validates a revision before committing a lesson", async () => {
    expect((await submit({ action: "commit", sessionId })).status).toBe(400);
    expect(commitNextLesson).not.toHaveBeenCalled();
  });
  it("rejects revoked access before generating or saving", async () => {
    vi.mocked(resolveCourseAccess).mockRejectedValueOnce(new DashboardError("Access revoked", 403));
    expect((await submit({ action: "prepare", sessionId })).status).toBe(403);
    expect(prepareNextLesson).not.toHaveBeenCalled(); expect(acquireGenerationLease).not.toHaveBeenCalled();
  });
  it("permits cancellation without submitting provider work", async () => {
    vi.mocked(cancelSession).mockResolvedValue({ session: { ...session, status: "cancelled" }, discardedLessonIds: ["lesson"], changed: true });
    const response = await submit({ action: "cancel", sessionId });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ session: { ...session, status: "cancelled" }, removedLessonIds: ["lesson"], changed: true });
    expect(cache.revalidatePath).toHaveBeenCalledWith("/dashboard", "page");
    expect(cleanupCancelledSessionLessons).not.toHaveBeenCalled();
    expect(cancelSession).toHaveBeenCalledWith({ ownerId: "owner", courseId: "course" }, sessionId);
    expect(requireAIEnabled).not.toHaveBeenCalled(); expect(acquireGenerationLease).not.toHaveBeenCalled();
  });
  it("rejects cross-origin mutations", async () => {
    expect((await submit({ action: "prepare", sessionId }, "https://elsewhere.invalid")).status).toBe(403);
    expect(prepareNextLesson).not.toHaveBeenCalled();
  });
});
