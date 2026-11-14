import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  connectToDatabase: vi.fn(async () => undefined),
  requireOwnerId: vi.fn(async () => "requester"),
  readJson: vi.fn(async () => ({ revision: 1 })),
  resolveCourseAccess: vi.fn(async () => ({ ownerId: "owner" })),
  saveCourseEditor: vi.fn(async () => ({ revision: 2 })),
  dashboardErrorResponse: vi.fn(() => new Response("Save failed", { status: 500 })),
}));

vi.mock("next/cache", () => ({ revalidatePath: dependencies.revalidatePath }));
vi.mock("@/lib/db/mongodb", () => ({ connectToDatabase: dependencies.connectToDatabase }));
vi.mock("@/lib/dashboard/http", () => ({
  dashboardErrorResponse: dependencies.dashboardErrorResponse,
  readJson: dependencies.readJson,
  requireOwnerId: dependencies.requireOwnerId,
}));
vi.mock("@/lib/workspaces/access", () => ({ resolveCourseAccess: dependencies.resolveCourseAccess }));
vi.mock("@/lib/editor/services/save", () => ({ saveCourseEditor: dependencies.saveCourseEditor }));

import { PUT } from "@/app/api/courses/[courseId]/editor/route";

const courseId = "507f1f77bcf86cd799439011";

function request() {
  return new NextRequest(`http://localhost/api/courses/${courseId}/editor`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Origin: "http://localhost" },
    body: "{}",
  });
}

describe("editor save route dashboard invalidation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("invalidates the dashboard page after the MongoDB editor save succeeds", async () => {
    const response = await PUT(request(), { params: Promise.resolve({ courseId }) });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ revision: 2 });
    expect(dependencies.revalidatePath).toHaveBeenCalledExactlyOnceWith("/dashboard", "page");
  });

  it("leaves the dashboard cache alone when the editor save fails", async () => {
    dependencies.saveCourseEditor.mockRejectedValueOnce(new Error("Database write failed"));
    const response = await PUT(request(), { params: Promise.resolve({ courseId }) });

    expect(response.status).toBe(500);
    expect(dependencies.revalidatePath).not.toHaveBeenCalled();
  });
});
