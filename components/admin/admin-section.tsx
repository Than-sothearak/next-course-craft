import { Suspense } from "react";
import { requirePagePermission } from "@/lib/auth/pages";
import type { Permission } from "@/lib/auth/policy";
import { AdminLoading } from "./admin-loading";
import { AdminOverview } from "./admin-overview";
import { UserDetail, UserManagement } from "./user-management";
import { CourseManagement } from "./course-management";
import { RoleManagement } from "./role-management";
import { AuditManagement } from "./audit-management";
import { SettingsManagement } from "./settings-management";

export type AdminSectionName = "overview" | "users" | "approvals" | "roles" | "courses" | "audit-logs" | "settings";
const permissions: Record<AdminSectionName, Permission> = { overview: "users.view", users: "users.view", approvals: "users.approve", roles: "roles.manage", courses: "courses.manage_all", "audit-logs": "audit.view", settings: "settings.manage" };

export function AdminSection({ section, params }: { section: AdminSectionName; params?: Promise<{ userId: string }> }) {
  return <Suspense fallback={<AdminLoading />}><SectionContent section={section} params={params} /></Suspense>;
}

async function SectionContent({ section, params }: { section: AdminSectionName; params?: Promise<{ userId: string }> }) {
  const user = await requirePagePermission(permissions[section], true);
  if (section === "approvals") await requirePagePermission("users.view", true);
  if (section === "courses") await requirePagePermission("courses.view", true);
  const authority = { actorId: user.id, role: user.role, permissions: user.permissions };
  if (params) return <UserDetail userId={(await params).userId} authority={authority} />;
  switch (section) {
    case "overview": return <AdminOverview permissions={user.permissions} />;
    case "users": return <UserManagement authority={authority} />;
    case "approvals": return <UserManagement authority={authority} approvals />;
    case "courses": return <CourseManagement permissions={user.permissions} />;
    case "roles": return <RoleManagement />;
    case "audit-logs": return <AuditManagement />;
    case "settings": return <SettingsManagement />;
  }
}
