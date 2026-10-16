import { createHash, randomBytes } from "node:crypto";
import { Types } from "mongoose";
import { User, Workspace, WorkspaceInvitation, WorkspaceMembership } from "@/models";
import { DashboardError } from "@/lib/dashboard/rules";
import type { CreateWorkspaceInput, CreateWorkspaceInvitationInput, UpdateWorkspaceMembershipInput } from "./schemas";
import { requireWorkspaceAccess, type WorkspaceRole } from "./access";
import { requirePermission, requireActiveUser } from "@/lib/auth/authorization";

const invitationLifetimeMs = 7 * 24 * 60 * 60 * 1000;

function objectId(value: string, label: string) {
  if (!Types.ObjectId.isValid(value)) throw new DashboardError(`${label} not found.`, 404);
  return new Types.ObjectId(value);
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function listWorkspaces(userId: string) {
  await requirePermission("courses.view", userId);
  const user = objectId(userId, "Account");
  const memberships = await WorkspaceMembership.find({ userId: user }).select("workspaceId").lean();
  const workspaces = await Workspace.find({
    $or: [{ ownerId: user }, { _id: { $in: memberships.map((membership) => membership.workspaceId) } }],
  }).sort({ name: 1 }).lean();
  const memberCounts = await WorkspaceMembership.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { workspaceId: { $in: workspaces.map((workspace) => workspace._id) } } },
    { $group: { _id: "$workspaceId", count: { $sum: 1 } } },
  ]);
  const countByWorkspace = new Map(memberCounts.map(({ _id, count }) => [_id.toString(), count + 1]));
  const roles = new Map(memberships.map((membership) => [membership.workspaceId.toString(), membership.role]));
  return workspaces.map((workspace) => ({
    id: workspace._id.toString(),
    name: workspace.name,
    role: workspace.ownerId.toString() === userId ? "owner" as const : roles.get(workspace._id.toString()) as Exclude<WorkspaceRole, "owner">,
    memberCount: countByWorkspace.get(workspace._id.toString()) ?? 1,
  }));
}

export async function createWorkspace(userId: string, input: CreateWorkspaceInput) {
  await requirePermission("workspaces.manage", userId);
  const ownerId = objectId(userId, "Account");
  const workspace = await Workspace.create({ name: input.name, ownerId });
  return { id: workspace._id.toString(), name: workspace.name, role: "owner" as const, memberCount: 1 };
}

export async function getWorkspaceRoster(userId: string, workspaceId: string) {
  const access = await requireWorkspaceAccess(userId, workspaceId, "manage");
  const [workspace, memberships, invitations] = await Promise.all([
    Workspace.findById(workspaceId).select("ownerId name").lean(),
    WorkspaceMembership.find({ workspaceId }).sort({ createdAt: 1 }).lean(),
    WorkspaceInvitation.find({ workspaceId, acceptedAt: null, revokedAt: null, expiresAt: { $gt: new Date() } })
      .sort({ createdAt: -1 }).lean(),
  ]);
  if (!workspace) throw new DashboardError("Workspace not found.", 404);
  const memberIds = memberships.map((member) => member.userId);
  const users = await User.find({ _id: { $in: [workspace.ownerId, ...memberIds] } }).select("name email image").lean();
  const userById = new Map((users as Array<{ _id: Types.ObjectId; name?: string; email?: string | null }>).map((user) => [user._id.toString(), user]));
  const owner = userById.get(workspace.ownerId.toString());

  return {
    workspace: { id: workspace._id.toString(), name: workspace.name, role: access.role },
    members: [
      { userId: workspace.ownerId.toString(), name: owner?.name ?? "Workspace owner", email: owner?.email ?? null, role: "owner" as const },
      ...memberships.map((member) => {
        const user = userById.get(member.userId.toString());
        return { userId: member.userId.toString(), name: user?.name ?? "Team member", email: user?.email ?? null, role: member.role as Exclude<WorkspaceRole, "owner"> };
      }),
    ],
    invitations: invitations.map((invitation) => ({
      id: invitation._id.toString(),
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt.toISOString(),
    })),
  };
}

export async function createWorkspaceInvitation(
  userId: string,
  workspaceId: string,
  input: CreateWorkspaceInvitationInput,
) {
  const access = await requireWorkspaceAccess(userId, workspaceId, "manage");
  if (input.role === "admin" && access.role !== "owner")
    throw new DashboardError("Only the workspace owner can invite an admin.", 403);
  const existingUser = await User.findOne({ email: input.email }).select("_id").lean();
  if (existingUser) {
    const existingUserId = (existingUser as { _id: Types.ObjectId })._id;
    const alreadyMember = existingUserId.toString() === access.ownerId || await WorkspaceMembership.exists({ workspaceId, userId: existingUserId });
    if (alreadyMember) throw new DashboardError("That person is already a workspace member.", 409);
  }

  await WorkspaceInvitation.updateMany(
    { workspaceId, email: input.email, acceptedAt: null, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + invitationLifetimeMs);
  const invitation = await WorkspaceInvitation.create({
    workspaceId,
    inviterId: userId,
    email: input.email,
    role: input.role,
    tokenHash: hashToken(token),
    expiresAt,
  });
  return {
    invitation: { id: invitation._id.toString(), email: invitation.email, role: invitation.role, expiresAt: expiresAt.toISOString() },
    invitePath: `/workspace-invitations/${token}`,
  };
}

export async function revokeWorkspaceInvitation(userId: string, workspaceId: string, invitationId: string) {
  const access = await requireWorkspaceAccess(userId, workspaceId, "manage");
  objectId(invitationId, "Invitation");
  const invitation = await WorkspaceInvitation.findOne({ _id: invitationId, workspaceId, acceptedAt: null, revokedAt: null });
  if (!invitation || invitation.expiresAt <= new Date()) throw new DashboardError("Invitation not found.", 404);
  if (invitation.role === "admin" && access.role !== "owner")
    throw new DashboardError("Only the workspace owner can revoke an admin invitation.", 403);
  invitation.revokedAt = new Date();
  await invitation.save();
}

export async function removeWorkspaceMember(userId: string, workspaceId: string, memberId: string) {
  const access = await requireWorkspaceAccess(userId, workspaceId, "view");
  objectId(memberId, "Member");
  if (memberId === access.ownerId) throw new DashboardError("The workspace owner cannot be removed.", 409);
  const target = await WorkspaceMembership.findOne({ workspaceId, userId: memberId }).lean();
  if (!target) throw new DashboardError("Workspace member not found.", 404);
  const selfLeave = userId === memberId;
  if (!selfLeave) {
    await requirePermission("workspaces.manage", userId);
    if (!roleAtLeastManager(access.role)) throw new DashboardError("You do not have permission to remove members.", 403);
    if (target.role === "admin" && access.role !== "owner")
      throw new DashboardError("Only the workspace owner can remove an admin.", 403);
  }
  await WorkspaceMembership.deleteOne({ _id: target._id, workspaceId, userId: memberId });
}

export async function updateWorkspaceMemberRole(
  userId: string,
  workspaceId: string,
  memberId: string,
  input: UpdateWorkspaceMembershipInput,
) {
  const access = await requireWorkspaceAccess(userId, workspaceId, "manage");
  objectId(memberId, "Member");
  if (memberId === access.ownerId) throw new DashboardError("The workspace owner role cannot be changed.", 409);
  if (input.role === "admin" && access.role !== "owner")
    throw new DashboardError("Only the workspace owner can assign the admin role.", 403);
  const target = await WorkspaceMembership.findOne({ workspaceId, userId: memberId });
  if (!target) throw new DashboardError("Workspace member not found.", 404);
  if (target.role === "admin" && access.role !== "owner")
    throw new DashboardError("Only the workspace owner can change an admin role.", 403);
  target.role = input.role;
  await target.save();
}

function roleAtLeastManager(role: WorkspaceRole) {
  return role === "owner" || role === "admin";
}

async function getInvitation(token: string) {
  if (!/^[\w-]{40,60}$/.test(token)) throw new DashboardError("Invitation not found or expired.", 404);
  const invitation = await WorkspaceInvitation.findOne({
    tokenHash: hashToken(token), acceptedAt: null, revokedAt: null, expiresAt: { $gt: new Date() },
  }).lean();
  if (!invitation) throw new DashboardError("Invitation not found or expired.", 404);
  const workspace = await Workspace.findById(invitation.workspaceId).select("name").lean();
  if (!workspace) throw new DashboardError("Invitation not found or expired.", 404);
  return { invitation, workspace };
}

export async function getWorkspaceInvitation(email: string | null, token: string) {
  const { invitation, workspace } = await getInvitation(token);
  return {
    workspaceName: workspace.name,
    role: invitation.role,
    emailMatches: Boolean(email && email.trim().toLowerCase() === invitation.email),
  };
}

export async function acceptWorkspaceInvitation(userId: string, email: string | null, token: string) {
  await requireActiveUser(userId);
  if (!email) throw new DashboardError("Sign in with the email address invited to this workspace.", 403);
  const { invitation } = await getInvitation(token);
  if (email.trim().toLowerCase() !== invitation.email)
    throw new DashboardError("This invitation was sent to a different email address.", 403);

  const userObjectId = objectId(userId, "Account");
  const workspaceId = invitation.workspaceId.toString();
  const existing = await WorkspaceMembership.exists({ workspaceId, userId: userObjectId });
  if (!existing) {
    await WorkspaceMembership.create({ workspaceId, userId: userObjectId, role: invitation.role });
  }
  const accepted = await WorkspaceInvitation.updateOne(
    { _id: invitation._id, acceptedAt: null, revokedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { acceptedAt: new Date() } },
  );
  if (accepted.modifiedCount !== 1) {
    if (!existing) await WorkspaceMembership.deleteOne({ workspaceId, userId: userObjectId });
    throw new DashboardError("Invitation not found or expired.", 404);
  }
  const workspace = await Workspace.findById(invitation.workspaceId).select("name").lean();
  return { workspaceId, workspaceName: workspace?.name ?? "Workspace" };
}
