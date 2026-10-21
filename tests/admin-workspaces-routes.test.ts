import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardError } from "@/lib/dashboard/rules";

const mocks = vi.hoisted(() => ({ requireAdmin: vi.fn(), requireRole: vi.fn(), list: vi.fn(), view: vi.fn(), update: vi.fn(), remove: vi.fn() }));
vi.mock("@/lib/auth/authorization", () => ({ requireAdmin: mocks.requireAdmin, requireRole: mocks.requireRole }));
vi.mock("@/lib/admin/workspaces", () => ({ listAdminWorkspaces: mocks.list, getAdminWorkspace: mocks.view, updateAdminWorkspace: mocks.update, deleteAdminWorkspace: mocks.remove }));

import { GET as list } from "@/app/api/admin/workspaces/route";
import { GET as view, PATCH as update, DELETE as remove } from "@/app/api/admin/workspaces/[workspaceId]/route";

const workspaceId = "507f1f77bcf86cd799439012";
const timestamp = "2026-10-21T00:00:00.000Z";
const context = { params: Promise.resolve({ workspaceId }) };
const request = (method: string, body?: unknown) => new NextRequest(`http://localhost/api/admin/workspaces/${workspaceId}`, { method, ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) });
const updateBody = { name: "New team", expectedUpdatedAt: timestamp };
const deleteBody = { confirmName: "Old team", expectedUpdatedAt: timestamp };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({ id: "super", role: "super_admin" });
  mocks.requireRole.mockResolvedValue({ id: "super", role: "super_admin" });
  mocks.list.mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 });
  mocks.view.mockResolvedValue({ workspace: { id: workspaceId } });
  mocks.update.mockResolvedValue({ id: workspaceId });
  mocks.remove.mockResolvedValue({ id: workspaceId });
});

describe("Super Admin workspace API routes", () => {
  it.each([401, 403])("denies every operation with status %s before invoking the service", async (status) => {
    mocks.requireAdmin.mockRejectedValue(new DashboardError("Access denied.", status));
    const responses = await Promise.all([list(request("GET")), view(request("GET"), context), update(request("PATCH", updateBody), context), remove(request("DELETE", deleteBody), context)]);
    for (const response of responses) {
      expect(response.status).toBe(status);
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    }
    for (const service of [mocks.list, mocks.view, mocks.update, mocks.remove]) expect(service).not.toHaveBeenCalled();
  });

  it("denies platform Admins despite their workspace management permission", async () => {
    mocks.requireAdmin.mockResolvedValue({ id: "admin", role: "admin" });
    mocks.requireRole.mockRejectedValue(new DashboardError("Access denied.", 403));
    const responses = await Promise.all([list(request("GET")), view(request("GET"), context), update(request("PATCH", updateBody), context), remove(request("DELETE", deleteBody), context)]);
    expect(responses.map((response) => response.status)).toEqual([403, 403, 403, 403]);
    expect(mocks.requireRole).toHaveBeenCalledWith(["super_admin"], "admin");
    for (const service of [mocks.list, mocks.view, mocks.update, mocks.remove]) expect(service).not.toHaveBeenCalled();
  });

  it("passes validated list queries and returns private responses", async () => {
    const response = await list(new NextRequest("http://localhost/api/admin/workspaces?q=Team&page=2"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.list).toHaveBeenCalledWith("super", expect.objectContaining({ q: "Team", page: 2 }));
    expect((await view(request("GET"), context)).status).toBe(200);
    expect(mocks.view).toHaveBeenCalledWith("super", workspaceId);
  });

  it("passes strict update and delete inputs to the services", async () => {
    expect((await update(request("PATCH", updateBody), context)).status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith("super", workspaceId, updateBody);
    expect((await remove(request("DELETE", deleteBody), context)).status).toBe(200);
    expect(mocks.remove).toHaveBeenCalledWith("super", workspaceId, deleteBody);
  });

  it("rejects missing confirmations, stale-check fields and browser-injected ownership", async () => {
    expect((await update(request("PATCH", { name: "Team" }), context)).status).toBe(400);
    expect((await update(request("PATCH", { ...updateBody, ownerId: "forged" }), context)).status).toBe(400);
    expect((await remove(request("DELETE", { expectedUpdatedAt: timestamp }), context)).status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON and cross-site mutations", async () => {
    const malformed = new NextRequest("http://localhost/api/admin/workspaces/id", { method: "PATCH", body: "{" });
    expect((await update(malformed, context)).status).toBe(400);
    const crossSite = new NextRequest("http://localhost/api/admin/workspaces/id", { method: "DELETE", headers: { "Sec-Fetch-Site": "cross-site" }, body: JSON.stringify(deleteBody) });
    expect((await remove(crossSite, context)).status).toBe(403);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
