import { Types } from "mongoose";
import { Course, Folder, Workspace, WorkspaceMembership } from "@/models";
import { DashboardError } from "@/lib/dashboard/rules";

export const workspaceRoles = ["owner", "admin", "editor", "viewer"] as const;
export type WorkspaceRole = (typeof workspaceRoles)[number];
export type WorkspacePermission = "view" | "edit" | "manage";

const roleRank: Record<WorkspaceRole, number> = {
  viewer: 0,
  editor: 1,
  admin: 2,
  owner: 3,
};

export function roleCan(role: WorkspaceRole, permission: WorkspacePermission) {
  const required = permission === "view" ? 0 : permission === "edit" ? 1 : 2;
  return roleRank[role] >= required;
}

function assertObjectId(value: string, kind: string) {
  if (!Types.ObjectId.isValid(value))
    throw new DashboardError(`${kind} not found.`, 404);
}

export async function requireWorkspaceAccess(
  userId: string,
  workspaceId: string,
  permission: WorkspacePermission = "view",
) {
  assertObjectId(workspaceId, "Workspace");
  if (!Types.ObjectId.isValid(userId))
    throw new DashboardError("Your account session is invalid. Sign in again.", 401);

  const workspace = await Workspace.findById(workspaceId).select("name ownerId").lean();
  if (!workspace) throw new DashboardError("Workspace not found.", 404);

  let role: WorkspaceRole | null = null;
  if (workspace.ownerId.toString() === userId) {
    role = "owner";
  } else {
    const membership = await WorkspaceMembership.findOne({ workspaceId, userId })
      .select("role")
      .lean();
    if (membership) role = membership.role as Exclude<WorkspaceRole, "owner">;
  }
  if (!role) throw new DashboardError("Workspace not found.", 404);
  if (!roleCan(role, permission))
    throw new DashboardError("You do not have permission to do that in this workspace.", 403);

  return {
    id: workspace._id.toString(),
    ownerId: workspace.ownerId.toString(),
    name: workspace.name,
    role,
  };
}

export async function resolveCourseAccess(
  userId: string,
  courseId: string,
  permission: WorkspacePermission = "view",
  options: { includeDeleted?: boolean } = {},
) {
  assertObjectId(courseId, "Course");
  const course = await Course.findOne({ _id: courseId, ...(options.includeDeleted ? {} : { deletedAt: null }) })
    .select("ownerId workspaceId")
    .lean();
  if (!course) throw new DashboardError("Course not found.", 404);

  if (course.workspaceId) {
    const workspace = await requireWorkspaceAccess(userId, course.workspaceId.toString(), permission);
    return {
      ownerId: course.ownerId.toString(),
      workspaceId: workspace.id,
      role: workspace.role,
    };
  }
  if (course.ownerId.toString() !== userId)
    throw new DashboardError("Course not found.", 404);
  return { ownerId: course.ownerId.toString(), workspaceId: null, role: "owner" as const };
}

export async function resolveFolderAccess(
  userId: string,
  folderId: string,
  permission: WorkspacePermission = "view",
) {
  assertObjectId(folderId, "Folder");
  const folder = await Folder.findById(folderId).select("ownerId workspaceId").lean();
  if (!folder) throw new DashboardError("Folder not found.", 404);
  if (folder.workspaceId) {
    const workspace = await requireWorkspaceAccess(userId, folder.workspaceId.toString(), permission);
    return { ownerId: folder.ownerId.toString(), workspaceId: workspace.id, role: workspace.role };
  }
  if (folder.ownerId.toString() !== userId)
    throw new DashboardError("Folder not found.", 404);
  return { ownerId: folder.ownerId.toString(), workspaceId: null, role: "owner" as const };
}

export async function resolveDashboardAccess(userId: string, workspaceId: string | null, permission: WorkspacePermission = "view") {
  if (!workspaceId)
    return { ownerId: userId, workspaceId: null, workspaceName: "Personal", role: "owner" as const };
  const workspace = await requireWorkspaceAccess(userId, workspaceId, permission);
  return { ...workspace, workspaceId: workspace.id, workspaceName: workspace.name };
}
