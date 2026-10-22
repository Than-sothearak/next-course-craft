import { redirect, notFound } from "next/navigation";
import { DashboardError } from "@/lib/dashboard/rules";
import { requireActiveUser, requireAuthenticatedUser, getFreshPrincipal } from "./authorization";
import { can, type Permission } from "./policy";
import { resolveCourseAccess } from "@/lib/workspaces/access";

export function handlePageAuthorizationError(error: unknown): never {
  if (error instanceof DashboardError) {
    if (error.status === 401) redirect("/login");
    if (error.status === 403) redirect("/access-denied");
    if (error.status === 404) notFound();
  }
  throw error;
}

export async function requirePageUser(options?: { allowPrefetch?: boolean }) {
  try {
    const identity = await requireAuthenticatedUser(options);
    const principal = await getFreshPrincipal(identity.id);
    if (principal.status !== "active") redirect("/account-status");
    return principal;
  } catch (error) {
    return handlePageAuthorizationError(error);
  }
}

export async function requirePagePermission(permission: Permission, admin = false, options?: { allowPrefetch?: boolean }) {
  const principal = await requirePageUser(options);
  if (!can(principal, permission) || (admin && !["admin", "super_admin"].includes(principal.role))) redirect("/access-denied");
  // Subsequent API operations always re-read the database.
  return principal;
}

export { requireActiveUser };

export async function requirePageCourseAccess(userId: string, courseId: string, permission: Permission) {
  try { return await resolveCourseAccess(userId, courseId, permission); }
  catch (error) { return handlePageAuthorizationError(error); }
}
