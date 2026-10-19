import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ admin: vi.fn(), role: vi.fn(), list: vi.fn() }));
vi.mock("@/lib/auth/authorization", () => ({ requireAdmin: mocks.admin, requireRole: mocks.role }));
vi.mock("@/lib/media/local-browser", () => ({ listLocalStorageFolders: mocks.list }));
import { GET } from "@/app/api/admin/settings/media-storage/folders/route";
import { DashboardError } from "@/lib/dashboard/rules";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.admin.mockResolvedValue({ id: "actor" });
  mocks.role.mockResolvedValue({ role: "super_admin" });
  mocks.list.mockResolvedValue({ root: "/storage", path: "/storage", parent: null, folders: [], truncated: false });
});
describe("Super Admin folder browser endpoint", () => {
  it("checks current Super Admin authority before reading the filesystem and returns no-store", async () => {
    const response = await GET(new NextRequest("https://courses.example/api/admin/settings/media-storage/folders?path=%2Fstorage"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.role).toHaveBeenCalledWith(["super_admin"], "actor", undefined);
    expect(mocks.list).toHaveBeenCalledWith("/storage");
    expect(mocks.role.mock.invocationCallOrder[0]).toBeLessThan(mocks.list.mock.invocationCallOrder[0]);
  });
  it("denies an Admin even when a broader admin permission check succeeds", async () => {
    mocks.role.mockRejectedValue(new DashboardError("Access denied", 403));
    const response = await GET(new NextRequest("https://courses.example/api/admin/settings/media-storage/folders?path=%2Fstorage"));
    expect(response.status).toBe(403);
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it("does not browse for an unauthenticated request", async () => {
    mocks.admin.mockRejectedValue(new DashboardError("Sign in", 401));
    expect((await GET(new NextRequest("https://courses.example/api/admin/settings/media-storage/folders"))).status).toBe(401);
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it("rejects unexpected query fields before touching disk", async () => {
    expect((await GET(new NextRequest("https://courses.example/api/admin/settings/media-storage/folders?path=%2Fstorage&extra=bad"))).status).toBe(400);
    expect(mocks.list).not.toHaveBeenCalled();
  });
});
