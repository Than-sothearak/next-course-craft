import { Types } from "mongoose";
import { Course, Folder, User, Workspace, WorkspaceInvitation, WorkspaceMembership } from "@/models";
import { requireRole } from "@/lib/auth/authorization";
import { DashboardError, escapeRegex } from "@/lib/dashboard/rules";
import { deleteAdminWorkspaceSchema, idSchema, listQuerySchema, updateAdminWorkspaceSchema, type ListQuery } from "./schemas";
import { audit, securityTransaction } from "./transactions";
import type { AdminWorkspace, AdminWorkspaceDetail, PageResult } from "./types";

const pageSize = 20;
const detailLimit = 100;
type WorkspaceRow = { _id: Types.ObjectId; name: string; ownerId: Types.ObjectId; createdAt: Date; updatedAt: Date };
type CountRow = { _id: Types.ObjectId; count: number };

async function workspaceRows(workspaces: WorkspaceRow[]): Promise<AdminWorkspace[]> {
  if (!workspaces.length) return [];
  const ids = workspaces.map((workspace) => workspace._id);
  const countPipeline = [
    { $match: { workspaceId: { $in: ids } } },
    { $group: { _id: "$workspaceId", count: { $sum: 1 } } },
  ];
  const [owners, memberships, courses, folders] = await Promise.all([
    User.find({ _id: { $in: workspaces.map((workspace) => workspace.ownerId) } }).select("name email").lean(),
    WorkspaceMembership.aggregate<CountRow>(countPipeline),
    Course.aggregate<CountRow>(countPipeline),
    Folder.aggregate<CountRow>(countPipeline),
  ]);
  const ownerById = new Map(owners.map((owner) => [owner._id.toString(), owner]));
  const counts = (rows: CountRow[]) => new Map(rows.map((row) => [row._id.toString(), row.count]));
  const memberCounts = counts(memberships), courseCounts = counts(courses), folderCounts = counts(folders);
  return workspaces.map((workspace) => {
    const id = workspace._id.toString();
    const owner = ownerById.get(workspace.ownerId.toString());
    return {
      id, name: workspace.name, ownerId: workspace.ownerId.toString(),
      ownerName: owner?.name || "Workspace owner", ownerEmail: owner?.email ?? null,
      memberCount: (memberCounts.get(id) ?? 0) + 1,
      courseCount: courseCounts.get(id) ?? 0, folderCount: folderCounts.get(id) ?? 0,
      createdAt: workspace.createdAt.toISOString(), updatedAt: workspace.updatedAt.toISOString(),
    };
  });
}

export async function listAdminWorkspaces(actorId: string, input: ListQuery): Promise<PageResult<AdminWorkspace>> {
  await requireRole(["super_admin"], actorId);
  const query = listQuerySchema.parse(input);
  const filter: Record<string, unknown> = {};
  if (query.ownerId) filter.ownerId = query.ownerId;
  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q), "i");
    const owners = await User.find({ $or: [{ name: pattern }, { email: pattern }] }).select("_id").lean();
    filter.$or = [{ name: pattern }, { ownerId: { $in: owners.map((owner) => owner._id) } }];
  }
  const [workspaces, total] = await Promise.all([
    Workspace.find(filter).sort({ updatedAt: -1, _id: -1 }).skip((query.page - 1) * pageSize).limit(pageSize).lean(),
    Workspace.countDocuments(filter),
  ]);
  return { items: await workspaceRows(workspaces), page: query.page, pageSize, total };
}

export async function getAdminWorkspace(actorId: string, workspaceId: string): Promise<AdminWorkspaceDetail> {
  await requireRole(["super_admin"], actorId);
  idSchema.parse(workspaceId);
  const workspace = await Workspace.findById(workspaceId).lean();
  if (!workspace) throw new DashboardError("Workspace not found.", 404);
  const invitationFilter = { workspaceId, acceptedAt: null, revokedAt: null, expiresAt: { $gt: new Date() } };
  const [rows, memberships, invitations, invitationCount, courses] = await Promise.all([
    workspaceRows([workspace]),
    WorkspaceMembership.find({ workspaceId }).sort({ createdAt: 1, _id: 1 }).limit(detailLimit).lean(),
    WorkspaceInvitation.find(invitationFilter).select("email role expiresAt").sort({ createdAt: -1, _id: -1 }).limit(detailLimit).lean(),
    WorkspaceInvitation.countDocuments(invitationFilter),
    Course.find({ workspaceId }).select("title status deletedAt updatedAt").sort({ updatedAt: -1, _id: -1 }).limit(10).lean(),
  ]);
  const users = await User.find({ _id: { $in: memberships.map((member) => member.userId) } }).select("name email").lean();
  const userById = new Map(users.map((user) => [user._id.toString(), user]));
  const summary = rows[0];
  return {
    workspace: summary,
    members: [
      { userId: summary.ownerId, name: summary.ownerName, email: summary.ownerEmail, role: "owner" },
      ...memberships.map((member) => {
        const user = userById.get(member.userId.toString());
        return { userId: member.userId.toString(), name: user?.name || "Team member", email: user?.email ?? null, role: member.role as "admin" | "editor" | "viewer" };
      }),
    ],
    invitations: invitations.map((invitation) => ({ id: invitation._id.toString(), email: invitation.email, role: invitation.role, expiresAt: invitation.expiresAt.toISOString() })),
    invitationCount,
    courses: courses.map((course) => ({ id: course._id.toString(), title: course.title, status: course.status, deletedAt: course.deletedAt?.toISOString() ?? null, updatedAt: course.updatedAt.toISOString() })),
  };
}

export async function updateAdminWorkspace(actorId: string, workspaceId: string, input: unknown) {
  await requireRole(["super_admin"], actorId);
  idSchema.parse(workspaceId);
  const data = updateAdminWorkspaceSchema.parse(input);
  return securityTransaction(async (session) => {
    await requireRole(["super_admin"], actorId, session);
    const workspace = await Workspace.findById(workspaceId).session(session);
    if (!workspace) throw new DashboardError("Workspace not found.", 404);
    if (workspace.updatedAt.toISOString() !== data.expectedUpdatedAt)
      throw new DashboardError("The workspace changed. Refresh and try again.", 409);
    const previousName = workspace.name;
    workspace.name = data.name;
    await workspace.save({ session });
    await audit(session, { actorId, action: "workspaces.update", targetType: "workspace", targetId: workspaceId, metadata: { previousName, name: workspace.name } });
    return { id: workspaceId, name: workspace.name, updatedAt: workspace.updatedAt.toISOString() };
  });
}

export async function deleteAdminWorkspace(actorId: string, workspaceId: string, input: unknown) {
  await requireRole(["super_admin"], actorId);
  idSchema.parse(workspaceId);
  const data = deleteAdminWorkspaceSchema.parse(input);
  return securityTransaction(async (session) => {
    await requireRole(["super_admin"], actorId, session);
    const workspace = await Workspace.findById(workspaceId).session(session);
    if (!workspace) throw new DashboardError("Workspace not found.", 404);
    if (workspace.updatedAt.toISOString() !== data.expectedUpdatedAt)
      throw new DashboardError("The workspace changed. Refresh and try again.", 409);
    if (data.confirmName !== workspace.name)
      throw new DashboardError("The workspace name confirmation did not match.", 400);
    // Recently deleted courses still belong to the workspace and block deletion.
    const course = await Course.exists({ workspaceId }).session(session);
    const folder = await Folder.exists({ workspaceId }).session(session);
    if (course || folder)
      throw new DashboardError("Only empty workspaces can be deleted. Move all courses (including recently deleted courses) out and remove all folders first.", 409);
    await WorkspaceMembership.deleteMany({ workspaceId }, { session });
    await WorkspaceInvitation.deleteMany({ workspaceId }, { session });
    await Workspace.deleteOne({ _id: workspaceId }, { session });
    await audit(session, { actorId, action: "workspaces.delete", targetType: "workspace", targetId: workspaceId, metadata: { name: workspace.name, ownerId: workspace.ownerId.toString() } });
    return { id: workspaceId };
  });
}
