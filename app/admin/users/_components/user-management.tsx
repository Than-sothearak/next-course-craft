"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import type { AdminUser, PageResult } from "@/lib/admin/types";
import { accountStatuses, platformRoles } from "@/lib/auth/policy";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminLoading } from "@/app/admin/_components/admin-loading";
import { dateLabel, Notice, Pagination, StatusBadge, UserAvatar } from "@/app/admin/_components/shared/admin-common";
import { useAdminMutation, useAdminResource } from "@/app/admin/_components/shared/use-admin-resource";
import { availableActions } from "./_components/user-management-actions";
import { UserMutationDialog } from "./_components/user-mutation-dialog";
import type { Authority } from "./_components/user-management-types";

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
