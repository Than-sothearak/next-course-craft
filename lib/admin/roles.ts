import { PlatformSettings, RolePermission } from "@/models";
import { requireAdmin } from "@/lib/auth/authorization";
import { roleCeilings, platformRoles, type Permission } from "@/lib/auth/policy";
import { DashboardError } from "@/lib/dashboard/rules";
import { audit, securityTransaction } from "./transactions";
import type { z } from "zod";
import type { roleMutationSchema } from "./schemas";

export async function getRolePolicies(actorId: string) {
  await requireAdmin("roles.manage", actorId);
  const policies = await RolePermission.find().lean();
  return platformRoles.map((role) => ({
    role,
    permissions: roleCeilings[role].filter((permission) => role === "super_admin" || !policies.some((policy) => policy.role === role) || policies.find((policy) => policy.role === role)!.permissions.includes(permission)),
    ceiling: [...roleCeilings[role]],
  }));
}

export function validateRolePermissions(role: "admin" | "editor" | "viewer", permissions: readonly Permission[]) {
  if (permissions.some((permission) => !roleCeilings[role].includes(permission))) throw new DashboardError("Those permissions exceed this role's security limits.", 403);
  return [...new Set(permissions)];
}

export async function updateRolePermissions(actorId: string, input: z.infer<typeof roleMutationSchema>) {
  const permissions = validateRolePermissions(input.role, input.permissions);
  return securityTransaction(async (session) => {
    const actor = await requireAdmin("roles.manage", actorId, session);
    if (actor.role !== "super_admin") throw new DashboardError("Only Super Admin can manage permissions.", 403);
    const previous = await RolePermission.findOne({ role: input.role }).session(session).lean();
    const role = await RolePermission.findOneAndUpdate({ role: input.role }, { $set: { permissions, updatedBy: actorId } }, { upsert: true, new: true, runValidators: true, session });
    await audit(session, { actorId, action: "roles.permissions", targetType: "role", targetId: role._id.toString(), metadata: { role: input.role, previous: previous?.permissions ?? roleCeilings[input.role], permissions } });
    return { role: input.role, permissions };
  });
}

export async function updateSettings(actorId: string, aiEnabled: boolean) {
  return securityTransaction(async (session) => {
    const actor = await requireAdmin("settings.manage", actorId, session);
    if (actor.role !== "super_admin") throw new DashboardError("Access denied.", 403);
    const previous = await PlatformSettings.findById("platform").session(session).lean();
    await PlatformSettings.updateOne({ _id: "platform" }, { $set: { aiEnabled } }, { upsert: true, runValidators: true, session });
    await audit(session, { actorId, action: "settings.update", targetType: "settings", metadata: { previousAIEnabled: previous?.aiEnabled ?? true, aiEnabled } });
    return { aiEnabled };
  });
}
