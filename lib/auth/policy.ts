export const platformRoles = ["super_admin", "admin", "editor", "viewer"] as const;
export const accountStatuses = ["pending", "active", "rejected", "suspended"] as const;
export type PlatformRole = (typeof platformRoles)[number];
export type AccountStatus = (typeof accountStatuses)[number];

export const permissionGroups = {
  Users: ["users.view", "users.approve", "users.manage", "roles.assign", "roles.manage"],
  Courses: ["courses.create", "courses.view", "courses.edit", "courses.delete", "courses.assign", "courses.manage_all", "courses.transfer", "workspaces.manage"],
  Publishing: ["courses.publish", "courses.export"],
  AI: ["ai.generate"],
  Settings: ["settings.manage"],
  Auditing: ["audit.view"],
} as const;
export const permissionIds = Object.values(permissionGroups).flat();
export type Permission = (typeof permissionIds)[number];

export const roleCeilings: Record<PlatformRole, readonly Permission[]> = {
  super_admin: permissionIds,
  admin: ["users.view", "users.approve", "users.manage", "roles.assign", "courses.create", "courses.view", "courses.edit", "courses.delete", "courses.assign", "courses.manage_all", "courses.publish", "courses.export", "ai.generate", "workspaces.manage", "audit.view"],
  editor: ["courses.create", "courses.view", "courses.edit", "courses.delete", "courses.assign", "courses.publish", "courses.export", "ai.generate", "workspaces.manage"],
  viewer: ["courses.view"],
};

export type Principal = {
  id: string;
  name: string;
  email: string | null;
  image: string | null;
  role: PlatformRole;
  status: AccountStatus;
  permissions: Permission[];
};

export function effectivePermissions(role: PlatformRole, status: AccountStatus, configured?: readonly string[] | null, personal?: readonly string[] | null): Permission[] {
  if (status !== "active") return [];
  if (role === "super_admin") return [...permissionIds];
  return roleCeilings[role].filter((permission) =>
    (configured == null || configured.includes(permission)) &&
    (personal == null || personal.includes(permission)),
  );
}

export function can(principal: Pick<Principal, "status" | "permissions">, permission: Permission) {
  return principal.status === "active" && principal.permissions.includes(permission);
}

export function canManageUser(actor: Principal, target: { id: string; role: string }) {
  if (actor.id === target.id || actor.status !== "active") return false;
  return actor.role === "super_admin" || (actor.role === "admin" && target.role !== "admin" && target.role !== "super_admin");
}

export function canAssignRole(actor: Principal, role: PlatformRole) {
  return can(actor, "roles.assign") && (actor.role === "super_admin" || (actor.role === "admin" && (role === "editor" || role === "viewer")));
}

export function retainsActiveSuperAdmin(target: { role: string; status: string }, next: { role: string; status: string }, count: number) {
  return target.role !== "super_admin" || target.status !== "active" || (next.role === "super_admin" && next.status === "active") || count > 1;
}
