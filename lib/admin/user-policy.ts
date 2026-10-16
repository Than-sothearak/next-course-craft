import { DashboardError } from "@/lib/dashboard/rules";
import { can, canAssignRole, canManageUser, retainsActiveSuperAdmin, type Principal } from "@/lib/auth/policy";
import type { UserMutation } from "./schemas";

export function decideUserMutation(actor: Principal, target: { id: string; role: string; status: string; deletedAt?: Date | null }, input: UserMutation, activeSuperAdmins: number) {
  if (!canManageUser(actor, target)) throw new DashboardError("You cannot manage this account.", 403);
  if (target.deletedAt) throw new DashboardError("This account has been removed.", 409);
  const permission = input.action === "approve" || input.action === "reject" ? "users.approve" : input.action === "role" ? "roles.assign" : "users.manage";
  if (!can(actor, permission)) throw new DashboardError("Access denied.", 403);
  let role = target.role;
  let status = target.status;
  if (input.action === "approve") {
    if (!["pending", "rejected"].includes(status)) throw new DashboardError("Only pending or rejected registrations can be approved.", 409);
    role = input.role;
    status = "active";
  } else if (input.action === "reject") {
    if (status !== "pending") throw new DashboardError("Only pending registrations can be rejected.", 409);
    status = "rejected";
  } else if (input.action === "suspend") {
    if (status !== "active") throw new DashboardError("Only active accounts can be suspended.", 409);
    status = "suspended";
  } else if (input.action === "reactivate") {
    if (status !== "suspended") throw new DashboardError("Only suspended accounts can be reactivated.", 409);
    status = "active";
  } else if (input.action === "role") {
    if (!["active", "suspended"].includes(status)) throw new DashboardError("Approve the registration before changing its role.", 409);
    role = input.role;
  } else {
    if (actor.role !== "super_admin") throw new DashboardError("Only Super Admin can remove accounts.", 403);
    status = "rejected";
  }
  if ((input.action === "approve" || input.action === "role") && !canAssignRole(actor, input.role)) throw new DashboardError("You cannot assign that role.", 403);
  if (!retainsActiveSuperAdmin(target, { role, status }, activeSuperAdmins)) throw new DashboardError("The last active Super Admin must remain active.", 409);
  return { role, status };
}
