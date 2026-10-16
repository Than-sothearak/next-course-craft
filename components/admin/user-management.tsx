"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import type { AdminUser, PageResult, AdminUserDetail } from "@/lib/admin/types";
import { accountStatuses, platformRoles, type Permission, type PlatformRole } from "@/lib/auth/policy";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminLoading } from "./admin-loading";
import { dateLabel, Notice, Pagination, StatusBadge, UserAvatar } from "./admin-common";
import { useAdminMutation, useAdminResource } from "./use-admin-resource";

type Authority = { actorId: string; role: PlatformRole; permissions: Permission[] };
type Mutation = ReturnType<typeof useAdminMutation>;

function availableActions(user: AdminUser, authority: Authority) {
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

function UserMutationDialog({ user, authority, mutation, onClose }: { user: AdminUser; authority: Authority; mutation: Mutation; onClose: () => void }) {
  const actions = availableActions(user, authority);
  const [action, setAction] = useState(actions[0] ?? "approve");
  const [role, setRole] = useState(user.status === "pending" || !platformRoles.includes(user.role as PlatformRole) ? "editor" : user.role);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body: Record<string, unknown> = { action, expectedUpdatedAt: user.updatedAt };
    if (action === "approve" || action === "role") body.role = role;
    if (action === "suspend") body.reason = form.get("reason");
    if (action === "delete") body.confirmEmail = form.get("confirmEmail");
    if (await mutation.mutate(`/api/admin/users/${user.id}`, "PATCH", body)) onClose();
  }
  return <Dialog open title={`Manage ${user.name}`} onClose={onClose} busy={mutation.busy}><form onSubmit={submit} className="space-y-5">
    <div className="flex items-center gap-3"><UserAvatar name={user.name} image={user.image} /><div><p className="font-medium">{user.email ?? user.name}</p><p className="text-sm text-slate-500">Registered {dateLabel(user.createdAt)}</p></div><StatusBadge status={user.status} /></div>
    <label className="block text-sm font-medium">Action<Select aria-label="Action" value={action} onChange={(event) => setAction(event.target.value)} className="mt-2">{actions.map((item) => <option key={item} value={item}>{({ approve: "Approve registration", reject: "Reject registration", role: "Change role", suspend: "Suspend access", reactivate: "Reactivate access", delete: "Remove account access" } as Record<string, string>)[item]}</option>)}</Select></label>
    {(action === "approve" || action === "role") && <label className="block text-sm font-medium">Assigned role<Select aria-label="Assigned role" value={role} onChange={(event) => setRole(event.target.value)} className="mt-2">{(authority.role === "super_admin" ? platformRoles : ["editor", "viewer"]).map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</Select></label>}
    {action === "suspend" && <label className="block text-sm font-medium">Suspension reason<Textarea name="reason" required maxLength={1000} className="mt-2" /></label>}
    {action === "delete" && <><p className="text-sm leading-6 text-slate-600">This removes platform access and retains the account record and its courses for ownership history.</p><label className="block text-sm font-medium">Type {user.email} to confirm<Input name="confirmEmail" type="email" required className="mt-2" autoComplete="off" /></label></>}
    {action === "suspend" && <p className="text-sm text-slate-600">Existing sessions will lose access on their next protected request.</p>}
    <Notice notice={mutation.notice?.error ? mutation.notice : null} />
    <div className="flex justify-end gap-3"><Button variant="outline" onClick={onClose} disabled={mutation.busy}>Cancel</Button><Button type="submit" variant={["reject", "suspend", "delete"].includes(action) ? "destructive" : "default"} disabled={mutation.busy || !actions.length}>{mutation.busy ? "Saving…" : "Confirm change"}</Button></div>
  </form></Dialog>;
}

export function UserManagement({ authority, approvals = false }: { authority: Authority; approvals?: boolean }) {
  const [filters, setFilters] = useState({ q: "", role: "", status: approvals ? "pending" : "", page: 1 });
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const params = new URLSearchParams({ q: filters.q, role: filters.role, status: filters.status, page: String(filters.page) });
  const resource = useAdminResource<PageResult<AdminUser>>(`/api/admin/users?${params}`);
  const mutation = useAdminMutation(resource.reload);
  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    setFilters({ q: String(data.get("q") ?? ""), role: String(data.get("role") ?? ""), status: approvals ? "pending" : String(data.get("status") ?? ""), page: 1 });
  }
  return <div className="space-y-6"><div><h1 className="text-3xl font-semibold tracking-tight">{approvals ? "Approval queue" : "User management"}</h1><p className="mt-2 text-slate-500">{approvals ? "Review registrations and choose each person’s role before approving access." : "Manage account access, roles, and registration requests."}</p></div>
    <Notice notice={mutation.notice} /><Notice notice={resource.error ? { error: true, message: resource.error } : null} />
    <Card className="overflow-hidden"><form onSubmit={filter} className="flex flex-wrap gap-3 border-b border-slate-200 p-5"><Input name="q" aria-label="Search users" placeholder="Search name or email" maxLength={100} className="min-w-48 flex-1" /><Select name="role" aria-label="Filter role" className="w-40"><option value="">All roles</option>{platformRoles.filter((role) => authority.role === "super_admin" || !["admin", "super_admin"].includes(role)).map((role) => <option key={role}>{role}</option>)}</Select>{!approvals && <Select name="status" aria-label="Filter status" className="w-40"><option value="">All statuses</option>{accountStatuses.map((status) => <option key={status}>{status}</option>)}</Select>}<Button type="submit">Filter</Button><Button variant="outline" onClick={() => { setSelected(null); resource.reload(); }}>Refresh</Button></form>
      {resource.loading ? <AdminLoading /> : <><Table><TableHeader><TableRow>{["User", "Role", "Status", "Registered", "Last login", "Actions"].map((label) => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader><TableBody>{resource.data?.items.map((user) => <TableRow key={user.id}>
        <TableCell><div className="flex items-center gap-3"><UserAvatar name={user.name} image={user.image} /><div><Link href={`/admin/users/${user.id}`} className="font-semibold text-slate-900 hover:text-indigo-600">{user.name}</Link><p className="text-xs text-slate-500">{user.email ?? "No email"}</p></div></div></TableCell><TableCell className="capitalize">{user.role.replaceAll("_", " ")}</TableCell><TableCell><StatusBadge status={user.deletedAt ? "removed" : user.status} /></TableCell><TableCell className="whitespace-nowrap text-xs text-slate-500">{dateLabel(user.createdAt)}</TableCell><TableCell className="whitespace-nowrap text-xs text-slate-500">{dateLabel(user.lastLoginAt)}</TableCell><TableCell><div className="flex gap-2"><Link href={`/admin/users/${user.id}`} className={buttonVariants({ size: "sm", variant: "ghost" })}>Details</Link>{availableActions(user, authority).length > 0 && <Button size="sm" variant="outline" disabled={mutation.busy} onClick={() => setSelected(user)}>{user.status === "pending" ? "Review" : "Manage"}</Button>}</div></TableCell>
      </TableRow>)}</TableBody></Table>{resource.data?.total === 0 && <p className="p-10 text-center text-sm text-slate-500">No accounts match your filters.</p>}{resource.data && <Pagination {...resource.data} onPage={(page) => setFilters((old) => ({ ...old, page }))} disabled={mutation.busy} />}</>}
    </Card>{selected && <UserMutationDialog key={selected.id} user={selected} authority={authority} mutation={mutation} onClose={() => setSelected(null)} />}
  </div>;
}

export function UserDetail({ userId, authority }: { userId: string; authority: Authority }) {
  const resource = useAdminResource<AdminUserDetail>(`/api/admin/users/${userId}`);
  const mutation = useAdminMutation(resource.reload);
  const [editing, setEditing] = useState(false);
  if (resource.loading) return <AdminLoading />;
  if (!resource.data) return <Notice notice={{ error: true, message: resource.error ?? "Account unavailable." }} />;
  const { user, courses, activity } = resource.data;
  return <div className="space-y-6"><Link href="/admin/users" className="text-sm font-medium text-indigo-600">← All users</Link><Notice notice={mutation.notice} /><Card className="p-6"><div className="flex flex-wrap items-center gap-4"><UserAvatar name={user.name} image={user.image} /><div className="flex-1"><h1 className="text-2xl font-semibold">{user.name}</h1><p className="text-slate-500">{user.email}</p></div><StatusBadge status={user.status} />{availableActions(user, authority).length > 0 && <Button onClick={() => setEditing(true)}>Manage account</Button>}</div><dl className="mt-6 grid gap-5 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Account ID</dt><dd className="mt-1 break-all font-mono text-xs">{user.id}</dd></div><div><dt className="text-slate-500">Role</dt><dd className="mt-1 capitalize">{user.role.replaceAll("_", " ")}</dd></div><div><dt className="text-slate-500">Registered</dt><dd className="mt-1">{dateLabel(user.createdAt)}</dd></div><div><dt className="text-slate-500">Last login</dt><dd className="mt-1">{dateLabel(user.lastLoginAt)}</dd></div></dl>{user.suspensionReason && <p className="mt-5 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">Suspension reason: {user.suspensionReason}</p>}</Card>
    <Card className="p-6"><div className="flex items-center justify-between gap-4"><h2 className="text-lg font-semibold">Owned and assigned courses</h2>{authority.permissions.includes("courses.manage_all") && <Link href={`/admin/courses?ownerId=${user.id}`} className="text-sm text-indigo-600">All owned courses →</Link>}</div><div className="mt-4 divide-y divide-slate-100">{courses.map((course) => <div key={course.id} className="flex items-center justify-between gap-4 py-4"><div><p className="font-medium">{course.title}</p><p className="mt-1 text-xs text-slate-500">{course.ownerId === user.id ? "Owner" : "Collaborator"} · Updated {dateLabel(course.updatedAt)}</p></div><StatusBadge status={course.deletedAt ? "deleted" : course.status} />{!course.deletedAt && <Link href={`/courses/${course.id}/preview`} className="text-sm text-indigo-600">Preview</Link>}</div>)}{!courses.length && <p className="py-5 text-sm text-slate-500">No courses available in your administrative scope.</p>}</div></Card>
    {authority.permissions.includes("audit.view") && <Card className="p-6"><h2 className="text-lg font-semibold">Recent activity</h2>{activity.map((entry) => <div key={entry.id} className="mt-4 flex justify-between gap-4 border-b border-slate-100 pb-4 text-sm"><p>{entry.action}<span className="ml-2 text-slate-500">by {entry.actorName}</span></p><time className="text-xs text-slate-500">{dateLabel(entry.createdAt)}</time></div>)}{!activity.length && <p className="mt-4 text-sm text-slate-500">No recorded administrative activity.</p>}</Card>}
    {editing && <UserMutationDialog user={user} authority={authority} mutation={mutation} onClose={() => setEditing(false)} />}
  </div>;
}
