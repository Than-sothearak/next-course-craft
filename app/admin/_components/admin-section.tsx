import { Suspense, type ReactNode } from "react";
import { cacheLife, cacheTag } from "next/cache";
import { handlePageAuthorizationError, requirePagePermission } from "@/lib/auth/pages";
import type { Permission } from "@/lib/auth/policy";
import { getAdminSummary, getAdminUserDetail, listAdminCourses, listAdminUsers, listAuditLogs } from "@/lib/admin/queries";
import { getRolePolicies } from "@/lib/admin/roles";
import { listQuerySchema } from "@/lib/admin/schemas";
import { AdminResourceProvider } from "./shared/admin-resource-provider";
import { PlatformSettings } from "@/models";
import { AdminLoading } from "@/app/admin/_components/admin-loading";
import { AdminOverview } from "@/app/admin/_components/admin-overview";
import { UserManagement } from "../users/_components/user-management";
import { UserDetail } from "../users/[userId]/_components/user-detail";
import { CourseManagement } from "@/app/admin/courses/_components/course-management";
import { RoleManagement } from "@/app/admin/roles/_components/role-management";
import { AuditManagement } from "@/app/admin/audit-logs/_components/audit-management";
import { SettingsManagement } from "@/app/admin/settings/_components/settings-management";

export type AdminSectionName =
  | "overview"
  | "users"
  | "approvals"
  | "roles"
  | "courses"
  | "audit-logs"
  | "settings";
const permissions: Record<AdminSectionName, Permission> = {
  overview: "users.view",
  users: "users.view",
  approvals: "users.approve",
  roles: "roles.manage",
  courses: "courses.manage_all",
  "audit-logs": "audit.view",
  settings: "settings.manage",
};

export function AdminSection({
  section,
  params,
  searchParams,
}: {
  section: AdminSectionName;
  params?: Promise<{ userId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<AdminLoading />}>
      <SectionContent section={section} params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function SectionContent({
  section,
  params,
  searchParams,
}: {
  section: AdminSectionName;
  params?: Promise<{ userId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const userId = params ? (await params).userId : undefined;
  const search = section === "courses" ? await searchParams : undefined;
  const ownerId = typeof search?.ownerId === "string" ? search.ownerId : "";
  const workspaceId = typeof search?.workspaceId === "string" ? search.workspaceId : "";
  return <CachedSectionContent section={section} userId={userId} ownerId={ownerId} workspaceId={workspaceId} />;
}

async function CachedSectionContent({ section, userId, ownerId, workspaceId }: {
  section: AdminSectionName;
  userId?: string;
  ownerId: string;
  workspaceId: string;
}) {
  'use cache: private';
  cacheLife({ stale: 300 });
  cacheTag("admin", `admin:${section}`);

  const user = await requirePagePermission(permissions[section], true, { allowPrefetch: true });
  if (section === "approvals") await requirePagePermission("users.view", true, { allowPrefetch: true });
  if (section === "courses") await requirePagePermission("courses.view", true, { allowPrefetch: true });
  const authority = {
    actorId: user.id,
    role: user.role,
    permissions: user.permissions,
  };
  function withResource(url: string, data: unknown, children: ReactNode) {
    return <AdminResourceProvider initialResource={{ url, data }}>{children}</AdminResourceProvider>;
  }
  if (userId) {
    cacheTag(`admin:users:${userId}`);
    const data = await getAdminUserDetail(user.id, userId).catch(handlePageAuthorizationError);
    return withResource(`/api/admin/users/${userId}`, data, <UserDetail userId={userId} authority={authority} />);
  }
  switch (section) {
    case "overview":
      return withResource("/api/admin", await getAdminSummary(user.id), <AdminOverview permissions={user.permissions} />);
    case "users":
      return withResource("/api/admin/users?q=&role=&status=&page=1", await listAdminUsers(user.id, listQuerySchema.parse({})), <UserManagement authority={authority} />);
    case "approvals":
      return withResource("/api/admin/users?q=&role=&status=pending&page=1", await listAdminUsers(user.id, listQuerySchema.parse({ status: "pending" })), <UserManagement authority={authority} approvals />);
    case "courses": {
      const query = listQuerySchema.parse({ ownerId: ownerId || undefined, workspaceId: workspaceId || undefined });
      const url = `/api/admin/courses?${new URLSearchParams({ page: "1", q: "", ownerId, workspaceId, courseStatus: "" })}`;
      return withResource(url, await listAdminCourses(user.id, query), <CourseManagement key={`${ownerId}:${workspaceId}`} permissions={user.permissions} initialOwnerId={ownerId} initialWorkspaceId={workspaceId} />);
    }
    case "roles":
      return withResource("/api/admin/roles", await getRolePolicies(user.id), <RoleManagement />);
    case "audit-logs":
      return withResource("/api/admin/audit-logs?q=&action=&from=&to=&page=1", await listAuditLogs(user.id, listQuerySchema.parse({})), <AuditManagement />);
    case "settings":
      return withResource("/api/admin/settings", { aiEnabled: (await PlatformSettings.findById("platform").lean())?.aiEnabled ?? true }, <SettingsManagement />);
  }
}
