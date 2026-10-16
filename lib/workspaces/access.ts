import { Types, type ClientSession } from "mongoose";
import { Course, CourseAssignment, Folder, Workspace, WorkspaceMembership } from "@/models";
import { DashboardError } from "@/lib/dashboard/rules";
import { requirePermission } from "@/lib/auth/authorization";
import { can, type Permission } from "@/lib/auth/policy";

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
  session?: ClientSession,
) {
  await requirePermission(permission === "view" ? "courses.view" : permission === "edit" ? "courses.edit" : "workspaces.manage", userId, session);
  assertObjectId(workspaceId, "Workspace");
  if (!Types.ObjectId.isValid(userId))
    throw new DashboardError("Your account session is invalid. Sign in again.", 401);

  const workspace = await Workspace.findById(workspaceId).select("name ownerId").session(session ?? null).lean();
  if (!workspace) throw new DashboardError("Workspace not found.", 404);

  let role: WorkspaceRole | null = null;
  if (workspace.ownerId.toString() === userId) {
    role = "owner";
  } else {
    const membership = await WorkspaceMembership.findOne({ workspaceId, userId })
      .select("role")
      .session(session ?? null)
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
  permission: WorkspacePermission | Permission = "view",
  options: { includeDeleted?: boolean; session?: ClientSession } = {},
) {
  const action: Permission = permission === "view" ? "courses.view" : permission === "edit" ? "courses.edit" : permission === "manage" ? "courses.delete" : permission;
  const principal = await requirePermission("courses.view", userId, options.session);
  if (!can(principal, action)) throw new DashboardError("You do not have permission to do that.", 403);
  assertObjectId(courseId, "Course");
  const course = await Course.findOne({ _id: courseId, ...(options.includeDeleted ? {} : { deletedAt: null }) })
    .select("ownerId workspaceId")
    .session(options.session ?? null)
    .lean();
  if (!course) throw new DashboardError("Course not found.", 404);

  let role: WorkspaceRole | null = null;
  if (can(principal, "courses.manage_all")) role = "admin";
  else if (course.ownerId.toString() === userId) role = "owner";
  else {
    const assignment = await CourseAssignment.findOne({ courseId, userId }).session(options.session ?? null).lean();
    if (assignment) role = assignment.role as "editor" | "viewer";
    if (course.workspaceId) {
      try {
        const workspace = await requireWorkspaceAccess(userId, course.workspaceId.toString(), "view", options.session);
        if (!role || roleRank[workspace.role] > roleRank[role]) role = workspace.role;
      } catch (error) {
        if (!(error instanceof DashboardError) || ![403, 404].includes(error.status)) throw error;
      }
    }
  }
  if (!role) throw new DashboardError("Course not found.", 404);
  if (!courseScopeCan(role, action)) throw new DashboardError("You do not have permission to do that with this course.", 403);
  const permissions = principal.permissions.filter((item) => courseScopeCan(role!, item));
  return { ownerId: course.ownerId.toString(), workspaceId: course.workspaceId?.toString() ?? null, role: permissions.includes("courses.edit") ? role : "viewer" as WorkspaceRole, permissions };
}

export function courseScopeCan(role: WorkspaceRole, permission: Permission) {
  if (!["courses.view", "courses.edit", "courses.delete", "courses.assign", "courses.transfer", "courses.publish", "courses.export", "ai.generate"].includes(permission)) return false;
  const required = permission === "courses.view" ? "view" : ["courses.delete", "courses.assign", "courses.transfer"].includes(permission) ? "manage" : "edit";
  return roleCan(role, required);
}

export const requireCoursePermission = resolveCourseAccess;

export async function courseAccessFilter(userId: string, permission: "courses.view" | "courses.edit" = "courses.view") {
  const principal = await requirePermission("courses.view", userId);
  if (!can(principal, permission)) throw new DashboardError("Access denied.", 403);
  if (can(principal, "courses.manage_all")) return {};
  const [memberships, assignments] = await Promise.all([
    WorkspaceMembership.find({ userId, ...(permission === "courses.edit" ? { role: { $in: ["admin", "editor"] } } : {}) }).select("workspaceId").lean(),
    CourseAssignment.find({ userId, ...(permission === "courses.edit" ? { role: "editor" } : {}) }).select("courseId").lean(),
  ]);
  return { $or: [{ ownerId: userId }, { workspaceId: { $in: memberships.map((membership) => membership.workspaceId) } }, { _id: { $in: assignments.map((assignment) => assignment.courseId) } }] };
}

export async function resolveFolderAccess(
  userId: string,
  folderId: string,
  permission: WorkspacePermission = "view",
) {
  await requirePermission(permission === "view" ? "courses.view" : permission === "edit" ? "courses.edit" : "courses.delete", userId);
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
  const principal = await requirePermission(permission === "view" ? "courses.view" : permission === "edit" ? "courses.create" : "workspaces.manage", userId);
  if (!workspaceId)
    return { ownerId: userId, workspaceId: null, workspaceName: "Personal", role: can(principal, "courses.edit") ? "owner" as const : "viewer" as const };
  const workspace = await requireWorkspaceAccess(userId, workspaceId, permission);
  return { ...workspace, role: can(principal, "courses.edit") ? workspace.role : "viewer" as const, workspaceId: workspace.id, workspaceName: workspace.name };
}
