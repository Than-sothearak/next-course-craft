"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { AdminCourse, PageResult } from "@/lib/admin/types";
import type { Permission } from "@/lib/auth/policy";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminLoading } from "./admin-loading";
import { dateLabel, Notice, Pagination, StatusBadge } from "./admin-common";
import { useAdminMutation, useAdminResource } from "./use-admin-resource";

function CourseMutationDialog({ course, permissions, mutation, onClose }: { course: AdminCourse; permissions: Permission[]; mutation: ReturnType<typeof useAdminMutation>; onClose: () => void }) {
  const actions = course.deletedAt ? permissions.includes("courses.delete") ? ["restore"] : [] : [permissions.includes("courses.edit") ? "archive" : "", permissions.includes("courses.transfer") ? "transfer" : "", permissions.includes("courses.delete") ? "delete" : ""].filter(Boolean);
  const [action, setAction] = useState(actions[0] ?? "archive");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const body: Record<string, unknown> = { action };
    if (action === "transfer" || action === "delete") body.confirmTitle = form.get("confirmTitle");
    if (action === "transfer") body.email = form.get("email");
    if (await mutation.mutate(`/api/admin/courses/${course.id}`, "PATCH", body)) onClose();
  }
  return <Dialog open title="Manage course" onClose={onClose} busy={mutation.busy}><form onSubmit={submit} className="space-y-5"><p className="text-lg font-medium">{course.title}</p><p className="text-sm text-slate-500">Owned by {course.ownerName} · {course.ownerEmail}</p><label className="block text-sm font-medium">Action<Select aria-label="Action" className="mt-2" value={action} onChange={(event) => setAction(event.target.value)}>{actions.map((item) => <option key={item} value={item}>{({ archive: "Archive course", transfer: "Transfer ownership", delete: "Move to recently deleted", restore: "Restore course" } as Record<string, string>)[item]}</option>)}</Select></label>
    {action === "transfer" && <><p className="rounded-lg bg-indigo-50 p-4 text-sm leading-6 text-indigo-900">The course will move to the approved new owner’s personal workspace root. Its lessons, media, creator attribution, and explicit course assignments are preserved. Previous workspace membership will no longer grant access.</p><label className="block text-sm font-medium">New owner’s account email<Input name="email" type="email" required className="mt-2" /></label></>}
    {(action === "transfer" || action === "delete") && <label className="block text-sm font-medium">Type the course title exactly to confirm<Input name="confirmTitle" required maxLength={160} className="mt-2" autoComplete="off" /></label>}
    <Notice notice={mutation.notice?.error ? mutation.notice : null} /><div className="flex justify-end gap-3"><Button variant="outline" onClick={onClose} disabled={mutation.busy}>Cancel</Button><Button type="submit" variant={action === "delete" ? "destructive" : "default"} disabled={mutation.busy || !actions.length}>{mutation.busy ? "Saving…" : "Confirm change"}</Button></div></form></Dialog>;
}

export function CourseManagement({ permissions }: { permissions: Permission[] }) {
  const search = useSearchParams();
  const [filters, setFilters] = useState({ page: 1, q: "", ownerId: search.get("ownerId") ?? "", courseStatus: "" });
  const [selected, setSelected] = useState<AdminCourse | null>(null);
  const resource = useAdminResource<PageResult<AdminCourse>>(`/api/admin/courses?${new URLSearchParams({ ...filters, page: String(filters.page) })}`);
  const mutation = useAdminMutation(resource.reload);
  function filter(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); setFilters({ page: 1, q: String(form.get("q") ?? ""), ownerId: String(form.get("ownerId") ?? ""), courseStatus: String(form.get("courseStatus") ?? "") }); }
  return <div className="space-y-6"><div><h1 className="text-3xl font-semibold tracking-tight">Course management</h1><p className="mt-2 text-slate-500">Manage course access, lifecycle, and ownership across the platform.</p></div><Notice notice={mutation.notice} /><Notice notice={resource.error ? { error: true, message: resource.error } : null} />
  <Card className="overflow-hidden"><form onSubmit={filter} className="flex flex-wrap gap-3 border-b p-5"><Input name="q" aria-label="Search course title" placeholder="Search course title" maxLength={100} className="min-w-48 flex-1" /><Input name="ownerId" aria-label="Filter by owner account ID" placeholder="Owner account ID" defaultValue={filters.ownerId} className="w-56" pattern="[a-fA-F0-9]{24}" /><Select name="courseStatus" aria-label="Course status" className="w-40"><option value="">All statuses</option>{["draft", "published", "archived", "deleted"].map((status) => <option key={status}>{status}</option>)}</Select><Button type="submit">Filter</Button><Button variant="outline" onClick={() => { setSelected(null); resource.reload(); }}>Refresh</Button></form>
  {resource.loading ? <AdminLoading /> : <><Table><TableHeader><TableRow>{["Course", "Owner", "Status", "Created", "Updated", "Actions"].map((label) => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader><TableBody>{resource.data?.items.map((course) => <TableRow key={course.id}><TableCell className="min-w-48 font-medium">{course.title}{course.workspaceId && <p className="mt-1 text-xs font-normal text-slate-500">Team workspace</p>}</TableCell><TableCell><p>{course.ownerName}</p><p className="text-xs text-slate-500">{course.ownerEmail ?? course.ownerId}</p></TableCell><TableCell><StatusBadge status={course.deletedAt ? "deleted" : course.status} /></TableCell><TableCell className="whitespace-nowrap text-xs text-slate-500">{dateLabel(course.createdAt)}</TableCell><TableCell className="whitespace-nowrap text-xs text-slate-500">{dateLabel(course.updatedAt)}</TableCell><TableCell><div className="flex flex-wrap gap-2">{!course.deletedAt && <><Link href={`/courses/${course.id}/preview`} className={buttonVariants({ size: "sm", variant: "ghost" })}>Preview</Link>{permissions.includes("courses.edit") && <Link href={`/courses/${course.id}/edit`} className={buttonVariants({ size: "sm", variant: "outline" })}>Edit</Link>}{permissions.includes("courses.assign") && <Link href={`/courses/${course.id}/access`} className={buttonVariants({ size: "sm", variant: "outline" })}>Share</Link>}</>}{permissions.some((permission) => ["courses.edit", "courses.delete", "courses.transfer"].includes(permission)) && <Button size="sm" variant="outline" onClick={() => setSelected(course)} disabled={mutation.busy}>Manage</Button>}</div></TableCell></TableRow>)}</TableBody></Table>{resource.data?.total === 0 && <p className="p-10 text-center text-sm text-slate-500">No courses match your filters.</p>}{resource.data && <Pagination {...resource.data} onPage={(page) => setFilters((old) => ({ ...old, page }))} />}</>}
  </Card>{selected && <CourseMutationDialog course={selected} permissions={permissions} mutation={mutation} onClose={() => setSelected(null)} />}</div>;
}
