import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../app/api/courses/[courseId]/slides/route";
import { PATCH as saveTheme } from "../app/api/courses/[courseId]/slides/theme/route";
import { createCourseSlide, saveSlideCourseTheme } from "../lib/slides/service";
import { resolveCourseAccess } from "../lib/workspaces/access";
import { DashboardError } from "../lib/dashboard/rules";
import { defaultSlideTheme } from "../lib/slides/themes";
vi.mock("../lib/db/mongodb", () => ({ connectToDatabase: vi.fn() }));
vi.mock("../lib/auth/authorization", () => ({ requireActiveUser: vi.fn(async () => ({ id: "507f1f77bcf86cd799439011" })) }));
vi.mock("../lib/workspaces/access", () => ({ resolveCourseAccess: vi.fn() }));
vi.mock("../lib/slides/service", () => ({ createCourseSlide: vi.fn(), getCourseSlides: vi.fn(), getSlideCourseTheme: vi.fn(), saveSlideCourseTheme: vi.fn() }));
const courseId = "507f1f77bcf86cd799439012", ownerId = "507f1f77bcf86cd799439013";
const context = { params: Promise.resolve({ courseId }) };
function request(body: unknown, method = "POST", origin?: string) { return new NextRequest(`http://localhost/api/courses/${courseId}/slides`, { method, headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) }, body: JSON.stringify(body) }); }
beforeEach(() => { vi.clearAllMocks(); vi.mocked(resolveCourseAccess).mockResolvedValue({ ownerId, permissions: ["courses.edit"] } as never); vi.mocked(createCourseSlide).mockResolvedValue({ id: "slide" } as never); });
describe("slide template and theme route authorization", () => {
  it("uses the permitted owner scope when creating a template slide", async () => {
    expect((await POST(request({ templateId: "cover" }), context)).status).toBe(201);
    expect(resolveCourseAccess).toHaveBeenCalledWith("507f1f77bcf86cd799439011", courseId, "edit");
    expect(createCourseSlide).toHaveBeenCalledWith(ownerId, courseId, undefined, "cover");
  });
  it("validates template identity and rejects cross-origin mutations", async () => {
    expect((await POST(request({ templateId: "script" }), context)).status).toBe(400);
    expect((await POST(request({ templateId: "cover" }, "POST", "https://foreign.example"), context)).status).toBe(403);
    expect(createCourseSlide).not.toHaveBeenCalled();
  });
  it("blocks viewers from slide and theme mutations", async () => {
    vi.mocked(resolveCourseAccess).mockRejectedValue(new DashboardError("Access denied.", 403));
    expect((await POST(request({ templateId: "cover" }), context)).status).toBe(403);
    expect((await saveTheme(request({ theme: defaultSlideTheme, revision: 0 }, "PATCH"), context)).status).toBe(403);
    expect(createCourseSlide).not.toHaveBeenCalled(); expect(saveSlideCourseTheme).not.toHaveBeenCalled();
  });
  it("validates and saves themes with edit permission and revision", async () => {
    vi.mocked(saveSlideCourseTheme).mockResolvedValue({ theme: defaultSlideTheme, revision: 1 });
    expect((await saveTheme(request({ theme: defaultSlideTheme, revision: 0 }, "PATCH"), context)).status).toBe(200);
    expect(resolveCourseAccess).toHaveBeenCalledWith("507f1f77bcf86cd799439011", courseId, "courses.edit");
    expect(saveSlideCourseTheme).toHaveBeenCalledWith(ownerId, courseId, { theme: defaultSlideTheme, revision: 0 });
    expect((await saveTheme(request({ theme: { ...defaultSlideTheme, bodyScale: 30 }, revision: 0 }, "PATCH"), context)).status).toBe(400);
  });
});
