"use client";

import { useState } from "react";
import { permissionGroups, platformRoles, type Permission, type PlatformRole } from "@/lib/auth/policy";
import type { RolePolicy } from "@/lib/admin/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminLoading } from "./admin-loading";
import { Notice } from "./admin-common";
import { useAdminMutation, useAdminResource } from "./use-admin-resource";

function PermissionMatrix({ policies, mutation }: { policies: RolePolicy[]; mutation: ReturnType<typeof useAdminMutation> }) {
  const [values, setValues] = useState(() => Object.fromEntries(policies.map((policy) => [policy.role, policy.permissions])) as Record<PlatformRole, Permission[]>);
  const [confirmRole, setConfirmRole] = useState<Exclude<PlatformRole, "super_admin"> | null>(null);
  return <><Card className="overflow-hidden"><Table><TableHeader><TableRow><TableHead>Permission</TableHead>{platformRoles.map((role) => <TableHead key={role} className="text-center">{role.replaceAll("_", " ")}</TableHead>)}</TableRow></TableHeader><TableBody>{Object.entries(permissionGroups).flatMap(([group, permissions]) => [<TableRow key={group}><TableCell colSpan={5} className="bg-slate-50 font-semibold text-indigo-900">{group}</TableCell></TableRow>, ...permissions.map((permission) => <TableRow key={permission}><TableCell className="font-mono text-xs">{permission}</TableCell>{platformRoles.map((role) => {
    const eligible = role !== "super_admin" && Boolean(policies.find((policy) => policy.role === role)?.ceiling.includes(permission));
    return <TableCell key={role} className="text-center"><Checkbox aria-label={`${role}: ${permission}`} disabled={!eligible || mutation.busy} checked={values[role].includes(permission)} onChange={(event) => setValues((old) => ({ ...old, [role]: event.target.checked ? [...old[role], permission] : old[role].filter((value) => value !== permission) }))} /></TableCell>;
  })}</TableRow>)])}</TableBody></Table><div className="flex flex-wrap justify-end gap-3 border-t p-5">{(["admin", "editor", "viewer"] as const).map((role) => <Button key={role} variant="outline" disabled={mutation.busy || JSON.stringify([...values[role]].sort()) === JSON.stringify([...(policies.find((policy) => policy.role === role)?.permissions ?? [])].sort())} onClick={() => setConfirmRole(role)}>Save {role} permissions</Button>)}</div></Card>
  {confirmRole && <Dialog open title="Confirm permission changes" onClose={() => setConfirmRole(null)} busy={mutation.busy}><p className="text-sm leading-6 text-slate-600">This updates permissions for every {confirmRole} account. The new policy applies to their next protected request.</p><Notice notice={mutation.notice?.error ? mutation.notice : null} /><div className="mt-6 flex justify-end gap-3"><Button variant="outline" disabled={mutation.busy} onClick={() => setConfirmRole(null)}>Cancel</Button><Button disabled={mutation.busy} onClick={async () => { if (await mutation.mutate("/api/admin/roles", "PUT", { role: confirmRole, permissions: values[confirmRole] })) setConfirmRole(null); }}>{mutation.busy ? "Saving…" : "Save permissions"}</Button></div></Dialog>}</>;
}

export function RoleManagement() {
  const resource = useAdminResource<RolePolicy[]>("/api/admin/roles");
  const mutation = useAdminMutation(resource.reload);
  return <div className="space-y-6"><div><h1 className="text-3xl font-semibold tracking-tight">Roles & permissions</h1><p className="mt-2 max-w-3xl leading-7 text-slate-500">Configure access within each role’s security limits. Super Admin privileges are fixed. Course permissions also require ownership, a workspace role, or a specific course assignment.</p></div><Notice notice={mutation.notice} /><Notice notice={resource.error ? { error: true, message: resource.error } : null} />{resource.loading ? <AdminLoading /> : resource.data && <PermissionMatrix policies={resource.data} mutation={mutation} />}</div>;
}
