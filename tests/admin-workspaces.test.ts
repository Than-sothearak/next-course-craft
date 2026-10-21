import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(), transaction: vi.fn(), audit: vi.fn(),
  workspaces: { find: vi.fn(), findById: vi.fn(), countDocuments: vi.fn(), deleteOne: vi.fn() },
  members: { aggregate: vi.fn(), find: vi.fn(), deleteMany: vi.fn() },
  invitations: { find: vi.fn(), countDocuments: vi.fn(), deleteMany: vi.fn() },
  courses: { aggregate: vi.fn(), find: vi.fn(), exists: vi.fn() },
  folders: { aggregate: vi.fn(), exists: vi.fn() }, users: { find: vi.fn() },
}));
vi.mock("@/lib/auth/authorization", () => ({ requireRole: mocks.requireRole }));
vi.mock("@/lib/admin/transactions", () => ({ securityTransaction: mocks.transaction, audit: mocks.audit }));
vi.mock("@/models", () => ({ Workspace: mocks.workspaces, WorkspaceMembership: mocks.members, WorkspaceInvitation: mocks.invitations, Course: mocks.courses, Folder: mocks.folders, User: mocks.users }));

import { deleteAdminWorkspace, getAdminWorkspace, listAdminWorkspaces, updateAdminWorkspace } from "@/lib/admin/workspaces";
import { listQuerySchema } from "@/lib/admin/schemas";
import { DashboardError } from "@/lib/dashboard/rules";

function query<T>(value: T) {
  const result = Object.assign(Promise.resolve(value), {
    select: vi.fn(), sort: vi.fn(), skip: vi.fn(),
    limit: vi.fn(), session: vi.fn(), lean: vi.fn(async () => value),
  });
  for (const method of ["select", "sort", "skip", "limit", "session"] as const) result[method].mockReturnValue(result);
  return result;
}
const actorId = "507f1f77bcf86cd799439011";
const workspaceId = "507f1f77bcf86cd799439012";
const ownerId = new Types.ObjectId("507f1f77bcf86cd799439013");
const timestamp = "2026-10-21T00:00:00.000Z";
const session = { id: "transaction" };
function workspace() {
  return { _id: new Types.ObjectId(workspaceId), name: "Learning team", ownerId, createdAt: new Date(timestamp), updatedAt: new Date(timestamp), save: vi.fn(async () => undefined) };
}
let current: ReturnType<typeof workspace>;
const deletion = () => ({ confirmName: current.name, expectedUpdatedAt: timestamp });

beforeEach(() => {
  vi.clearAllMocks();
  current = workspace();
  mocks.requireRole.mockResolvedValue({ id: actorId, role: "super_admin" });
  mocks.transaction.mockImplementation((work) => work(session));
  mocks.workspaces.find.mockImplementation(() => query([current]));
  mocks.workspaces.findById.mockImplementation(() => query(current));
  mocks.workspaces.countDocuments.mockResolvedValue(1);
  mocks.users.find.mockImplementation(() => query([{ _id: ownerId, name: "Owner", email: "owner@example.com" }]));
  mocks.members.aggregate.mockResolvedValue([]);
  mocks.courses.aggregate.mockResolvedValue([]);
  mocks.folders.aggregate.mockResolvedValue([]);
  mocks.members.find.mockImplementation(() => query([]));
  mocks.invitations.find.mockImplementation(() => query([]));
  mocks.invitations.countDocuments.mockResolvedValue(0);
  mocks.courses.find.mockImplementation(() => query([]));
  mocks.courses.exists.mockImplementation(() => query(null));
  mocks.folders.exists.mockImplementation(() => query(null));
});

describe("Super Admin workspace management", () => {
  it("lists workspaces across owners with paginated member and content counts", async () => {
    mocks.members.aggregate.mockResolvedValue([{ _id: current._id, count: 2 }]);
    mocks.courses.aggregate.mockResolvedValue([{ _id: current._id, count: 3 }]);
    mocks.folders.aggregate.mockResolvedValue([{ _id: current._id, count: 1 }]);
    const result = await listAdminWorkspaces(actorId, listQuerySchema.parse({ page: 2 }));
    expect(result).toMatchObject({ page: 2, pageSize: 20, total: 1, items: [{ id: workspaceId, ownerName: "Owner", ownerEmail: "owner@example.com", memberCount: 3, courseCount: 3, folderCount: 1 }] });
    expect(mocks.workspaces.find).toHaveBeenCalledWith({});
    const builder = mocks.workspaces.find.mock.results[0].value;
    expect(builder.skip).toHaveBeenCalledWith(20);
    expect(builder.limit).toHaveBeenCalledWith(20);
    expect(builder.sort).toHaveBeenCalledWith({ updatedAt: -1, _id: -1 });
  });

  it("escapes literal name and owner searches and intersects the owner filter", async () => {
    await listAdminWorkspaces(actorId, listQuerySchema.parse({ q: "Team (A)", ownerId: ownerId.toString() }));
    expect(mocks.workspaces.find).toHaveBeenCalledWith({ ownerId: ownerId.toString(), $or: [{ name: /Team \(A\)/i }, { ownerId: { $in: [ownerId] } }] });
  });

  it.each(["list", "view", "update", "delete"])("denies unauthorized %s operations before accessing workspace data", async (operation) => {
    mocks.requireRole.mockRejectedValue(new DashboardError("Access denied.", 403));
    const run = operation === "list" ? () => listAdminWorkspaces(actorId, listQuerySchema.parse({}))
      : operation === "view" ? () => getAdminWorkspace(actorId, workspaceId)
      : operation === "update" ? () => updateAdminWorkspace(actorId, workspaceId, { name: "New", expectedUpdatedAt: timestamp })
      : () => deleteAdminWorkspace(actorId, workspaceId, deletion());
    await expect(run()).rejects.toMatchObject({ status: 403 });
    expect(mocks.workspaces.find).not.toHaveBeenCalled();
    expect(mocks.workspaces.findById).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("returns bounded details with owner/member roles and no invitation secrets", async () => {
    const memberId = new Types.ObjectId();
    mocks.members.find.mockImplementation(() => query([{ userId: memberId, role: "editor" }]));
    mocks.users.find.mockImplementation(() => query([{ _id: ownerId, name: "Owner", email: "owner@example.com" }, { _id: memberId, name: "Member", email: "member@example.com" }]));
    mocks.invitations.find.mockImplementation(() => query([{ _id: new Types.ObjectId(), email: "invite@example.com", role: "viewer", expiresAt: new Date(timestamp), tokenHash: "private-token-hash" }]));
    mocks.invitations.countDocuments.mockResolvedValue(1);
    const result = await getAdminWorkspace(actorId, workspaceId);
    expect(result.members).toMatchObject([{ role: "owner", userId: ownerId.toString() }, { role: "editor", userId: memberId.toString() }]);
    expect(result.invitations).toMatchObject([{ email: "invite@example.com", role: "viewer" }]);
    expect(JSON.stringify(result)).not.toContain("private-token-hash");
    expect(mocks.invitations.find).toHaveBeenCalledWith(expect.objectContaining({ acceptedAt: null, revokedAt: null, expiresAt: { $gt: expect.any(Date) } }));
    expect(mocks.members.find.mock.results[0].value.limit).toHaveBeenCalledWith(100);
  });

  it("validates and trims updates without allowing ownership changes", async () => {
    await expect(updateAdminWorkspace(actorId, workspaceId, { name: "   ", expectedUpdatedAt: timestamp })).rejects.toThrow();
    await expect(updateAdminWorkspace(actorId, workspaceId, { name: "Changed", ownerId: actorId, expectedUpdatedAt: timestamp })).rejects.toThrow();
    expect(current.save).not.toHaveBeenCalled();
    await updateAdminWorkspace(actorId, workspaceId, { name: "  Renamed team  ", expectedUpdatedAt: timestamp });
    expect(current.name).toBe("Renamed team");
    expect(current.ownerId).toBe(ownerId);
    expect(current.save).toHaveBeenCalledWith({ session });
    expect(mocks.audit).toHaveBeenCalledWith(session, expect.objectContaining({ action: "workspaces.update", targetType: "workspace", metadata: { previousName: "Learning team", name: "Renamed team" } }));
  });

  it.each(["update", "delete"])("rejects stale %s requests", async (operation) => {
    current.updatedAt = new Date("2026-10-21T01:00:00.000Z");
    await expect(operation === "update" ? updateAdminWorkspace(actorId, workspaceId, { name: "New", expectedUpdatedAt: timestamp }) : deleteAdminWorkspace(actorId, workspaceId, deletion())).rejects.toMatchObject({ status: 409 });
    expect(current.save).not.toHaveBeenCalled();
    expect(mocks.workspaces.deleteOne).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it("rechecks current Super Admin authorization inside the transaction", async () => {
    mocks.requireRole.mockResolvedValueOnce({ role: "super_admin" }).mockRejectedValueOnce(new DashboardError("Account suspended.", 403));
    await expect(deleteAdminWorkspace(actorId, workspaceId, deletion())).rejects.toMatchObject({ status: 403 });
    expect(mocks.requireRole).toHaveBeenLastCalledWith(["super_admin"], actorId, session);
    expect(mocks.workspaces.deleteOne).not.toHaveBeenCalled();
  });

  it("requires an exact name confirmation before deletion", async () => {
    await expect(deleteAdminWorkspace(actorId, workspaceId, { ...deletion(), confirmName: "learning team" })).rejects.toMatchObject({ status: 400 });
    expect(mocks.workspaces.deleteOne).not.toHaveBeenCalled();
    expect(mocks.members.deleteMany).not.toHaveBeenCalled();
  });

  it.each(["course", "folder"])("blocks deletion when a %s exists and preserves memberships and invitations", async (kind) => {
    (kind === "course" ? mocks.courses.exists : mocks.folders.exists).mockImplementation(() => query({ _id: new Types.ObjectId() }));
    await expect(deleteAdminWorkspace(actorId, workspaceId, deletion())).rejects.toMatchObject({ status: 409 });
    // No deletedAt predicate: recently deleted courses must also block deletion.
    expect(mocks.courses.exists).toHaveBeenCalledWith({ workspaceId });
    expect(mocks.folders.exists).toHaveBeenCalledWith({ workspaceId });
    expect(mocks.workspaces.deleteOne).not.toHaveBeenCalled();
    expect(mocks.members.deleteMany).not.toHaveBeenCalled();
    expect(mocks.invitations.deleteMany).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it("deletes only the empty workspace and its relationships in the audited transaction", async () => {
    await expect(deleteAdminWorkspace(actorId, workspaceId, deletion())).resolves.toEqual({ id: workspaceId });
    expect(mocks.members.deleteMany).toHaveBeenCalledWith({ workspaceId }, { session });
    expect(mocks.invitations.deleteMany).toHaveBeenCalledWith({ workspaceId }, { session });
    expect(mocks.workspaces.deleteOne).toHaveBeenCalledWith({ _id: workspaceId }, { session });
    expect(mocks.audit).toHaveBeenCalledWith(session, { actorId, action: "workspaces.delete", targetType: "workspace", targetId: workspaceId, metadata: { name: current.name, ownerId: ownerId.toString() } });
  });

  it("returns not found for missing workspaces and validates identifiers", async () => {
    mocks.workspaces.findById.mockImplementation(() => query(null));
    await expect(getAdminWorkspace(actorId, workspaceId)).rejects.toMatchObject({ status: 404 });
    await expect(updateAdminWorkspace(actorId, workspaceId, { name: "New", expectedUpdatedAt: timestamp })).rejects.toMatchObject({ status: 404 });
    await expect(deleteAdminWorkspace(actorId, workspaceId, deletion())).rejects.toMatchObject({ status: 404 });
    await expect(getAdminWorkspace(actorId, "invalid")).rejects.toThrow("Invalid identifier");
  });
});
