import { Types, type ClientSession } from "mongoose";
import { connection } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { User, RolePermission, PlatformSettings } from "@/models";
import { DashboardError } from "@/lib/dashboard/rules";
import { accountStatuses, platformRoles, effectivePermissions, can, type Permission, type PlatformRole, type AccountStatus, type Principal } from "./policy";

export async function requireAuthenticatedUser() {
  // Auth.js creates cryptographic values while resolving a session. Keep that
  // work outside Cache Components / partial-prefetch prerenders.
  await connection();
  const { auth } = await import("@/lib/auth");
  const session = await auth();
  if (!session?.user?.id || !Types.ObjectId.isValid(session.user.id)) {
    throw new DashboardError("Sign in to continue.", 401);
  }
  return session.user;
}

// Deliberately no persistent cache: session cookies/JWT claims never authorize.
export async function getFreshPrincipal(userId: string, session?: ClientSession): Promise<Principal> {
  if (!Types.ObjectId.isValid(userId)) throw new DashboardError("Sign in to continue.", 401);
  await connectToDatabase();
  const user = await User.findById(userId).session(session ?? null).lean();
  if (!user) throw new DashboardError("Sign in to continue.", 401);
  const validRole = platformRoles.includes(user.role as PlatformRole);
  const role: PlatformRole = validRole ? user.role as PlatformRole : "viewer";
  const status: AccountStatus = user.deletedAt ? "rejected" : validRole && accountStatuses.includes(user.status as AccountStatus) ? user.status as AccountStatus : "pending";
  const policy = role === "super_admin" ? null : await RolePermission.findOne({ role }).session(session ?? null).lean();
  return {
    id: user._id.toString(),
    name: user.name || user.email || "Coursecraft user",
    email: user.email ?? null,
    image: user.image ?? null,
    role,
    status,
    permissions: effectivePermissions(role, status, policy?.permissions, user.permissions),
  };
}

export async function requireActiveUser(userId?: string, session?: ClientSession) {
  const id = userId ?? (await requireAuthenticatedUser()).id;
  const principal = await getFreshPrincipal(id, session);
  if (principal.status !== "active") throw new DashboardError("Your account is not active. Check your account status.", 403);
  return principal;
}

export async function requirePermission(permission: Permission, userId?: string, session?: ClientSession) {
  const principal = await requireActiveUser(userId, session);
  if (!can(principal, permission)) throw new DashboardError("You do not have permission to do that.", 403);
  return principal;
}

export async function requireRole(roles: readonly PlatformRole[], userId?: string, session?: ClientSession) {
  const principal = await requireActiveUser(userId, session);
  if (!roles.includes(principal.role)) throw new DashboardError("Access denied.", 403);
  return principal;
}

export async function requireAdmin(permission: Permission, userId?: string, session?: ClientSession) {
  const principal = await requirePermission(permission, userId, session);
  if (principal.role !== "admin" && principal.role !== "super_admin") throw new DashboardError("Access denied.", 403);
  return principal;
}

export async function requireAIEnabled() {
  const settings = await PlatformSettings.findById("platform").lean();
  if (settings?.aiEnabled === false) throw new DashboardError("AI generation is disabled by your administrator.", 403);
}
