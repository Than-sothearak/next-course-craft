import type { AdminUser } from "@/lib/admin/types";
import type { Authority } from "./user-management-types";

export function availableActions(user: AdminUser, authority: Authority) {
  const { permissions, role, actorId } = authority;
  if (actorId === user.id || user.deletedAt || (role !== "super_admin" && ["admin", "super_admin"].includes(user.role))) return [];
  const actions: string[] = [];
  if (["pending", "rejected"].includes(user.status) && permissions.includes("users.approve") && permissions.includes("roles.assign")) actions.push("approve");
  if (user.status === "pending" && permissions.includes("users.approve")) actions.push("reject");
  if (["active", "suspended"].includes(user.status) && permissions.includes("roles.assign")) actions.push("role");
  if (user.status === "active" && permissions.includes("users.manage")) actions.push("suspend");
  if (user.status === "suspended" && permissions.includes("users.manage")) actions.push("reactivate");
  if (role === "super_admin" && permissions.includes("users.manage")) actions.push("delete");
  return actions;
}
