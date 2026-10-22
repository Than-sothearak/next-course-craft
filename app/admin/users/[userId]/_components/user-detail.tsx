"use client";

import { AdminPrefetchLink } from "@/app/admin/_components/shared/admin-prefetch-link";
import { useState } from "react";
import Link from "next/link";
import type { AdminUserDetail } from "@/lib/admin/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AdminLoading } from "@/app/admin/_components/admin-loading";
import { dateLabel, Notice, StatusBadge, UserAvatar } from "@/app/admin/_components/shared/admin-common";
import { useAdminMutation, useAdminResource } from "@/app/admin/_components/shared/use-admin-resource";
import { availableActions } from "../../_components/_components/user-management-actions";
import { UserMutationDialog } from "../../_components/_components/user-mutation-dialog";
import type { Authority } from "../../_components/_components/user-management-types";

export function UserDetail({ userId, authority }: { userId: string; authority: Authority }) {
  const resource = useAdminResource<AdminUserDetail>(`/api/admin/users/${userId}`);
  const mutation = useAdminMutation(resource.reload);
  const [editing, setEditing] = useState(false);
  if (resource.loading) return <AdminLoading />;
  if (!resource.data) return <Notice notice={{ error: true, message: resource.error ?? "Account unavailable." }} />;
  const { user, courses, activity } = resource.data;
  return <div className="space-y-6"><AdminPrefetchLink href="/admin/users" className="text-sm font-medium text-indigo-600">← All users</AdminPrefetchLink><Notice notice={mutation.notice} /><Card className="p-6"><div className="flex flex-wrap items-center gap-4"><UserAvatar name={user.name} image={user.image} /><div className="flex-1"><h1 className="text-2xl font-semibold">{user.name}</h1><p className="text-slate-500">{user.email}</p></div><StatusBadge status={user.status} />{availableActions(user, authority).length > 0 && <Button onClick={() => setEditing(true)}>Manage account</Button>}</div><dl className="mt-6 grid gap-5 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Account ID</dt><dd className="mt-1 break-all font-mono text-xs">{user.id}</dd></div><div><dt className="text-slate-500">Role</dt><dd className="mt-1 capitalize">{user.role.replaceAll("_", " ")}</dd></div><div><dt className="text-slate-500">Registered</dt><dd className="mt-1">{dateLabel(user.createdAt)}</dd></div><div><dt className="text-slate-500">Last login</dt><dd className="mt-1">{dateLabel(user.lastLoginAt)}</dd></div></dl>{user.suspensionReason && <p className="mt-5 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">Suspension reason: {user.suspensionReason}</p>}</Card>
    <Card className="p-6"><div className="flex items-center justify-between gap-4"><h2 className="text-lg font-semibold">Owned and assigned courses</h2>{authority.permissions.includes("courses.manage_all") && <AdminPrefetchLink href={`/admin/courses?ownerId=${user.id}`} className="text-sm text-indigo-600">All owned courses →</AdminPrefetchLink>}</div><div className="mt-4 divide-y divide-slate-100">{courses.map((course) => <div key={course.id} className="flex items-center justify-between gap-4 py-4"><div><p className="font-medium">{course.title}</p><p className="mt-1 text-xs text-slate-500">{course.ownerId === user.id ? "Owner" : "Collaborator"} · Updated {dateLabel(course.updatedAt)}</p></div><StatusBadge status={course.deletedAt ? "deleted" : course.status} />{!course.deletedAt && <Link href={`/courses/${course.id}/preview`} className="text-sm text-indigo-600">Preview</Link>}</div>)}{!courses.length && <p className="py-5 text-sm text-slate-500">No courses available in your administrative scope.</p>}</div></Card>
    {authority.permissions.includes("audit.view") && <Card className="p-6"><h2 className="text-lg font-semibold">Recent activity</h2>{activity.map((entry) => <div key={entry.id} className="mt-4 flex justify-between gap-4 border-b border-slate-100 pb-4 text-sm"><p>{entry.action}<span className="ml-2 text-slate-500">by {entry.actorName}</span></p><time className="text-xs text-slate-500">{dateLabel(entry.createdAt)}</time></div>)}{!activity.length && <p className="mt-4 text-sm text-slate-500">No recorded administrative activity.</p>}</Card>}
    {editing && <UserMutationDialog user={user} authority={authority} mutation={mutation} onClose={() => setEditing(false)} />}
  </div>;
}
