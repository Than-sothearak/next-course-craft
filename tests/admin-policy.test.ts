import { describe, expect, it } from "vitest";
import { can, effectivePermissions, permissionIds, retainsActiveSuperAdmin, roleCeilings, type Principal } from "@/lib/auth/policy";
import { decideUserMutation } from "@/lib/admin/user-policy";
import { userMutationSchema, roleMutationSchema } from "@/lib/admin/schemas";

function actor(role: Principal["role"]): Principal {
  return { id: "actor", name: "Actor", email: null, image: null, role, status: "active", permissions: [...roleCeilings[role]] };
}
const pending = { id: "target", role: "viewer", status: "pending" };
const timestamp = "2026-10-16T00:00:00.000Z";

describe("platform authorization policy", () => {
  it.each(["pending", "rejected", "suspended"] as const)("grants no permissions for %s accounts, even with elevated stored roles", (status) => {
    expect(effectivePermissions("super_admin", status)).toEqual([]);
  });
  it("enforces role ceilings against malicious custom grants and preserves immutable Super Admin privileges", () => {
    expect(effectivePermissions("viewer", "active", permissionIds, permissionIds)).toEqual(["courses.view"]);
    expect(effectivePermissions("editor", "active", ["courses.view", "roles.manage", "courses.manage_all"])).toEqual(["courses.view"]);
    expect(effectivePermissions("super_admin", "active", [], [])).toEqual(permissionIds);
    expect(effectivePermissions("editor", "active", roleCeilings.editor, ["courses.view"])).toEqual(["courses.view"]);
  });
  it("activates an approved registration with the explicitly selected eligible role", () => {
    const result = decideUserMutation(actor("admin"), pending, { action: "approve", role: "editor", expectedUpdatedAt: timestamp }, 1);
    expect(result).toEqual({ role: "editor", status: "active" });
    expect(can({ status: "active", permissions: effectivePermissions("editor", "active") }, "courses.create")).toBe(true);
  });
  it("rejects Admin promotion, self management, and changes to administrative targets", () => {
    expect(() => decideUserMutation(actor("admin"), pending, { action: "approve", role: "super_admin", expectedUpdatedAt: timestamp }, 1)).toThrow("cannot assign");
    expect(() => decideUserMutation(actor("admin"), { id: "actor", role: "admin", status: "active" }, { action: "role", role: "super_admin", expectedUpdatedAt: timestamp }, 1)).toThrow("cannot manage");
    expect(() => decideUserMutation(actor("admin"), { ...pending, role: "super_admin", status: "active" }, { action: "suspend", reason: "Review", expectedUpdatedAt: timestamp }, 1)).toThrow("cannot manage");
  });
  it("denies viewer mutation and prevents reactivation of an unapproved registration", () => {
    expect(() => decideUserMutation(actor("viewer"), pending, { action: "approve", role: "editor", expectedUpdatedAt: timestamp }, 1)).toThrow();
    expect(() => decideUserMutation(actor("super_admin"), pending, { action: "reactivate", expectedUpdatedAt: timestamp }, 1)).toThrow("Only suspended");
  });
  it.each(["viewer", "admin"])("retains the last active Super Admin when demotion to %s is attempted", (role) => {
    expect(retainsActiveSuperAdmin({ role: "super_admin", status: "active" }, { role, status: "active" }, 1)).toBe(false);
  });
  it("retains the last active Super Admin for suspension/deletion and permits deliberate changes when another exists", () => {
    expect(retainsActiveSuperAdmin({ role: "super_admin", status: "active" }, { role: "super_admin", status: "suspended" }, 1)).toBe(false);
    expect(retainsActiveSuperAdmin({ role: "super_admin", status: "active" }, { role: "super_admin", status: "rejected" }, 1)).toBe(false);
    expect(retainsActiveSuperAdmin({ role: "super_admin", status: "active" }, { role: "viewer", status: "active" }, 2)).toBe(true);
  });
  it("rejects browser-injected fields and mutable Super Admin permission policies", () => {
    expect(userMutationSchema.safeParse({ action: "approve", role: "editor", expectedUpdatedAt: timestamp, permissions: permissionIds }).success).toBe(false);
    expect(roleMutationSchema.safeParse({ role: "super_admin", permissions: [] }).success).toBe(false);
  });
});
