import { afterEach, describe, expect, it, vi } from "vitest";
import { Workspace, WorkspaceMembership } from "../models";
import { requireWorkspaceAccess, roleCan } from "../lib/workspaces/access";
import { createWorkspaceInvitationSchema } from "../lib/workspaces/schemas";

vi.mock("../models", () => ({
  Course: {},
  Folder: {},
  Workspace: { findById: vi.fn() },
  WorkspaceMembership: { findOne: vi.fn() },
}));

const ownerId = "507f1f77bcf86cd799439011";
const memberId = "507f1f77bcf86cd799439012";
const workspaceId = "507f1f77bcf86cd799439013";

function mockWorkspace() {
  vi.mocked(Workspace.findById).mockReturnValue({
    select: () => ({ lean: async () => ({ _id: workspaceId, ownerId, name: "Learning" }) }),
  } as never);
}

afterEach(() => vi.restoreAllMocks());

describe("workspace access roles", () => {
  it("allows workspace viewers to view and reserves edits and team management for higher roles", () => {
    expect(roleCan("viewer", "view")).toBe(true);
    expect(roleCan("viewer", "edit")).toBe(false);
    expect(roleCan("editor", "edit")).toBe(true);
    expect(roleCan("editor", "manage")).toBe(false);
    expect(roleCan("admin", "manage")).toBe(true);
    expect(roleCan("owner", "manage")).toBe(true);
  });

  it("resolves the member role before granting workspace access", async () => {
    mockWorkspace();
    vi.mocked(WorkspaceMembership.findOne).mockReturnValue({
      select: () => ({ lean: async () => ({ role: "editor" }) }),
    } as never);

    await expect(requireWorkspaceAccess(memberId, workspaceId, "edit")).resolves.toMatchObject({
      id: workspaceId,
      ownerId,
      name: "Learning",
      role: "editor",
    });
    await expect(requireWorkspaceAccess(memberId, workspaceId, "manage")).rejects.toMatchObject({ status: 403 });
  });

  it("does not reveal workspaces to nonmembers and normalizes invitation email", async () => {
    mockWorkspace();
    vi.mocked(WorkspaceMembership.findOne).mockReturnValue({
      select: () => ({ lean: async () => null }),
    } as never);
    await expect(requireWorkspaceAccess(memberId, workspaceId)).rejects.toMatchObject({ status: 404 });
    expect(createWorkspaceInvitationSchema.parse({ email: " Team@Example.com ", role: "editor" })).toEqual({
      email: "team@example.com",
      role: "editor",
    });
  });
});
