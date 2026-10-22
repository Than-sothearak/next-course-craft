"use client";

import { AdminPrefetchLink } from "@/app/admin/_components/shared/admin-prefetch-link";
import { Users, Clock3, UserCheck, UserX, BookOpen, Send } from "lucide-react";
import type { AdminSummary } from "@/lib/admin/types";
import type { Permission } from "@/lib/auth/policy";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AdminLoading } from "@/app/admin/_components/admin-loading";
import { dateLabel, Notice, StatusBadge, UserAvatar } from "@/app/admin/_components/shared/admin-common";
import { useAdminResource } from "@/app/admin/_components/shared/use-admin-resource";

export function AdminOverview({ permissions }: { permissions: Permission[] }) {
  const resource = useAdminResource<AdminSummary>("/api/admin");
  if (resource.loading) return <AdminLoading />;
  if (!resource.data) return <Notice notice={{ error: true, message: resource.error ?? "Administration is unavailable." }} />;
  const { counts, registrations, activity } = resource.data;
  const cards = [{ label: "Total users", value: counts.totalUsers, icon: Users }, { label: "Pending approvals", value: counts.pending, icon: Clock3 }, { label: "Active users", value: counts.active, icon: UserCheck }, { label: "Suspended users", value: counts.suspended, icon: UserX }, { label: "Total courses", value: counts.totalCourses, icon: BookOpen }, { label: "Published courses", value: counts.published, icon: Send }];
  return <div className="space-y-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Platform administration</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">A clear view of Coursecraft</h1><p className="mt-2 text-slate-500">Review access requests and keep your learning workspace organized.</p></div><Button variant="outline" onClick={resource.reload}>Refresh</Button></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{cards.map(({ label, value, icon: Icon }) => <Card key={label} className="flex items-center justify-between p-6"><div><p className="text-sm text-slate-500">{label}</p><p className="mt-3 text-3xl font-semibold tracking-tight">{value ?? "—"}</p></div><span className="grid size-12 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><Icon size={23} /></span></Card>)}</div>
    <div className="grid gap-6 xl:grid-cols-2"><Card className="p-6"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Recent registrations</h2>{permissions.includes("users.approve") && <AdminPrefetchLink href="/admin/approvals" className="text-sm font-medium text-indigo-600">Review queue →</AdminPrefetchLink>}</div><div className="mt-5 divide-y divide-slate-100">{registrations.map((user) => <AdminPrefetchLink href={`/admin/users/${user.id}`} key={user.id} className="flex items-center gap-3 py-4"><UserAvatar name={user.name} image={user.image} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{user.name}</p><p className="truncate text-xs text-slate-500">{user.email}</p></div><StatusBadge status={user.status} /></AdminPrefetchLink>)}{!registrations.length && <p className="py-8 text-sm text-slate-500">No registrations yet.</p>}</div></Card>
    {permissions.includes("audit.view") && <Card className="p-6"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Recent activity</h2><AdminPrefetchLink href="/admin/audit-logs" className="text-sm font-medium text-indigo-600">View audit log →</AdminPrefetchLink></div><div className="mt-5 divide-y divide-slate-100">{activity.map((entry) => <div key={entry.id} className="py-4"><p className="text-sm font-medium">{entry.action}</p><p className="mt-1 text-xs text-slate-500">{entry.actorName} · {dateLabel(entry.createdAt)}</p></div>)}{!activity.length && <p className="py-8 text-sm text-slate-500">Administrative activity will appear here.</p>}</div></Card>}</div>
  </div>;
}
