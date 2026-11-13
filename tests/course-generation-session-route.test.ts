import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/courses/[courseId]/generation-session/route";
import { resolveCourseAccess } from "@/lib/workspaces/access";
import { requireAIEnabled } from "@/lib/auth/authorization";
import { acquireGenerationLease, releaseGenerationLease } from "@/lib/ai/generation-lease";
import { getSession, prepareNextLesson, commitNextLesson, cancelSession } from "@/lib/ai/generation/session-workflow";
import { DashboardError } from "@/lib/dashboard/rules";
vi.mock("@/lib/dashboard/http", async (original) => ({ ...await original<typeof import("@/lib/dashboard/http")>(), requireOwnerId: vi.fn(async () => "user") }));
vi.mock("@/lib/db/mongodb", () => ({ connectToDatabase: vi.fn() }));
vi.mock("@/lib/workspaces/access", () => ({ resolveCourseAccess: vi.fn(async () => ({ ownerId: "owner" })) }));
vi.mock("@/lib/auth/authorization", () => ({ requireAIEnabled: vi.fn() }));
vi.mock("@/lib/ai/generation-lease", () => ({ acquireGenerationLease: vi.fn(async () => ({ courseId: "course", token: "token" })), releaseGenerationLease: vi.fn(async () => undefined) }));
vi.mock("@/lib/ai/generation/session-workflow", () => ({ getSession: vi.fn(), planSession: vi.fn(), approveSession: vi.fn(), prepareNextLesson: vi.fn(), commitNextLesson: vi.fn(), cancelSession: vi.fn() }));
const context = { params: Promise.resolve({ courseId: "course" }) };
const sessionId = "507f1f77bcf86cd799439013";
const submit = (body: unknown, origin = "http://localhost") => POST(new NextRequest("http://localhost/api/courses/course/generation-session", { method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify(body) }), context);
beforeEach(() => { vi.clearAllMocks(); vi.mocked(resolveCourseAccess).mockResolvedValue({ ownerId: "owner" } as Awaited<ReturnType<typeof resolveCourseAccess>>); });
describe("generation session authorization and mutations", () => {
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
    vi.mocked(cancelSession).mockResolvedValue(null);
    expect((await submit({ action: "cancel", sessionId })).status).toBe(200);
    expect(cancelSession).toHaveBeenCalledWith({ ownerId: "owner", courseId: "course" }, sessionId);
    expect(requireAIEnabled).not.toHaveBeenCalled(); expect(acquireGenerationLease).not.toHaveBeenCalled();
  });
  it("rejects cross-origin mutations", async () => {
    expect((await submit({ action: "prepare", sessionId }, "https://elsewhere.invalid")).status).toBe(403);
    expect(prepareNextLesson).not.toHaveBeenCalled();
  });
});
