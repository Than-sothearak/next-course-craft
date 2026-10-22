"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import type { AdminCourse, PageResult } from "@/lib/admin/types";
import type { Permission } from "@/lib/auth/policy";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminLoading } from "@/app/admin/_components/admin-loading";
import { dateLabel, Notice, Pagination, StatusBadge } from "@/app/admin/_components/shared/admin-common";
import { useAdminMutation, useAdminResource } from "@/app/admin/_components/shared/use-admin-resource";
import { CourseMutationDialog } from "./_components/course-mutation-dialog";

export function CourseManagement({ permissions, initialOwnerId = "", initialWorkspaceId = "" }: { permissions: Permission[]; initialOwnerId?: string; initialWorkspaceId?: string }) {
  const [filters, setFilters] = useState({ page: 1, q: "", ownerId: initialOwnerId, workspaceId: initialWorkspaceId, courseStatus: "" });
  const [selected, setSelected] = useState<AdminCourse | null>(null);
  const resource = useAdminResource<PageResult<AdminCourse>>(`/api/admin/courses?${new URLSearchParams({ ...filters, page: String(filters.page) })}`);
  const mutation = useAdminMutation(resource.reload);
  function filter(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); setFilters({ page: 1, q: String(form.get("q") ?? ""), ownerId: String(form.get("ownerId") ?? ""), workspaceId: String(form.get("workspaceId") ?? ""), courseStatus: String(form.get("courseStatus") ?? "") }); }
  return <div className="space-y-6"><div><h1 className="text-3xl font-semibold tracking-tight">Course management</h1><p className="mt-2 text-slate-500">Manage course access, lifecycle, and ownership across the platform.</p></div><Notice notice={mutation.notice} /><Notice notice={resource.error ? { error: true, message: resource.error } : null} />
  <Card className="overflow-hidden"><form onSubmit={filter} className="flex flex-wrap gap-3 border-b p-5"><Input name="q" aria-label="Search course title" placeholder="Search course title" maxLength={100} className="min-w-48 flex-1" /><Input name="ownerId" aria-label="Filter by owner account ID" placeholder="Owner account ID" defaultValue={filters.ownerId} className="w-56" pattern="[a-fA-F0-9]{24}" /><Input name="workspaceId" aria-label="Filter by workspace ID" placeholder="Workspace ID" defaultValue={filters.workspaceId} className="w-56" pattern="[a-fA-F0-9]{24}" /><Select name="courseStatus" aria-label="Course status" className="w-40"><option value="">All statuses</option>{["draft", "published", "archived", "deleted"].map((status) => <option key={status}>{status}</option>)}</Select><Button type="submit">Filter</Button><Button variant="outline" onClick={() => { setSelected(null); resource.reload(); }}>Refresh</Button></form>
  {resource.loading ? <AdminLoading /> : <><Table><TableHeader><TableRow>{["Course", "Owner", "Status", "Created", "Updated", "Actions"].map((label) => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader><TableBody>{resource.data?.items.map((course) => <TableRow key={course.id}><TableCell className="min-w-48 font-medium">{course.title}{course.workspaceId && <p className="mt-1 text-xs font-normal text-slate-500">Team workspace</p>}</TableCell><TableCell><p>{course.ownerName}</p><p className="text-xs text-slate-500">{course.ownerEmail ?? course.ownerId}</p></TableCell><TableCell><StatusBadge status={course.deletedAt ? "deleted" : course.status} /></TableCell><TableCell className="whitespace-nowrap text-xs text-slate-500">{dateLabel(course.createdAt)}</TableCell><TableCell className="whitespace-nowrap text-xs text-slate-500">{dateLabel(course.updatedAt)}</TableCell><TableCell><div className="flex flex-wrap gap-2">{!course.deletedAt && <><Link href={`/courses/${course.id}/preview`} className={buttonVariants({ size: "sm", variant: "ghost" })}>Preview</Link>{permissions.includes("courses.edit") && <Link href={`/courses/${course.id}/edit`} className={buttonVariants({ size: "sm", variant: "outline" })}>Edit</Link>}{permissions.includes("courses.assign") && <Link href={`/courses/${course.id}/access`} className={buttonVariants({ size: "sm", variant: "outline" })}>Share</Link>}</>}{permissions.some((permission) => ["courses.edit", "courses.delete", "courses.transfer"].includes(permission)) && <Button size="sm" variant="outline" onClick={() => setSelected(course)} disabled={mutation.busy}>Manage</Button>}</div></TableCell></TableRow>)}</TableBody></Table>{resource.data?.total === 0 && <p className="p-10 text-center text-sm text-slate-500">No courses match your filters.</p>}{resource.data && <Pagination {...resource.data} onPage={(page) => setFilters((old) => ({ ...old, page }))} />}</>}
  </Card>{selected && <CourseMutationDialog course={selected} permissions={permissions} mutation={mutation} onClose={() => setSelected(null)} />}</div>;
}
