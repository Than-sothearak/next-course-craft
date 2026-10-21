"use client";

import type { RolePolicy } from "@/lib/admin/types";
import { AdminLoading } from "@/app/admin/_components/admin-loading";
import { Notice } from "@/app/admin/_components/shared/admin-common";
import { useAdminMutation, useAdminResource } from "@/app/admin/_components/shared/use-admin-resource";
import { PermissionMatrix } from "./_components/permission-matrix";

export function RoleManagement() {
  const resource = useAdminResource<RolePolicy[]>("/api/admin/roles");
  const mutation = useAdminMutation(resource.reload);
  return <div className="space-y-6"><div><h1 className="text-3xl font-semibold tracking-tight">Roles & permissions</h1><p className="mt-2 max-w-3xl leading-7 text-slate-500">Configure access within each role’s security limits. Super Admin privileges are fixed. Course permissions also require ownership, a workspace role, or a specific course assignment.</p></div><Notice notice={mutation.notice} /><Notice notice={resource.error ? { error: true, message: resource.error } : null} />{resource.loading ? <AdminLoading /> : resource.data && <PermissionMatrix policies={resource.data} mutation={mutation} />}</div>;
}
