"use client";

import { AdminPrefetchLink } from "@/app/admin/_components/shared/admin-prefetch-link";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AdminWorkspaceDetail } from "@/lib/admin/types";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminLoading } from "@/app/admin/_components/admin-loading";
import { dateLabel, Notice, StatusBadge } from "@/app/admin/_components/shared/admin-common";
import { useAdminResource } from "@/app/admin/_components/shared/use-admin-resource";
import { WorkspaceMutationDialog } from "../../_components/_components/workspace-mutation-dialog";
import type { WorkspaceAction } from "../../_components/_components/workspace-management-types";

export function WorkspaceDetail({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const resource = useAdminResource<AdminWorkspaceDetail>(`/api/admin/workspaces/${workspaceId}`);
  const [selected, setSelected] = useState<WorkspaceAction | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  if (resource.loading) return <AdminLoading />;
  const back = <AdminPrefetchLink href="/admin/workspaces" className="text-sm font-medium text-indigo-700 hover:underline">← All workspaces</AdminPrefetchLink>;
  if (!resource.data) return <div className="space-y-6">{back}<Notice notice={{ error: true, message: resource.error ?? "Workspace is unavailable." }} /><Button variant="outline" onClick={resource.reload}>Retry</Button></div>;
  const { workspace, members, invitations, invitationCount, courses } = resource.data;

  function saved() {
    if (selected?.action === "delete") {
      setSelected(null);
      router.push("/admin/workspaces");
      return;
    }
    setSelected(null);
    setMessage("Workspace updated.");
    resource.reload();
  }

  return <div className="space-y-6">
    {back}
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0"><h1 className="break-words text-3xl font-semibold tracking-tight">{workspace.name}</h1><p className="mt-2 text-slate-500">Workspace details and team access.</p></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={resource.reload}>Refresh</Button><Button onClick={() => setSelected({ workspace, action: "update" })}>Update</Button><Button variant="destructive" onClick={() => setSelected({ workspace, action: "delete" })}>Delete</Button></div>
    </div>
    <Notice notice={message ? { error: false, message } : null} />
    <Card className="p-6"><dl className="grid gap-5 text-sm sm:grid-cols-2 xl:grid-cols-3">
      <div><dt className="text-slate-500">Owner</dt><dd className="mt-1 break-words font-medium"><AdminPrefetchLink href={`/admin/users/${workspace.ownerId}`} className="text-indigo-700 hover:underline">{workspace.ownerName}</AdminPrefetchLink><p className="mt-1 text-xs font-normal text-slate-500">{workspace.ownerEmail ?? workspace.ownerId}</p></dd></div>
      <div><dt className="text-slate-500">Workspace ID</dt><dd className="mt-1 break-all font-mono text-xs">{workspace.id}</dd></div>
      <div><dt className="text-slate-500">Contents</dt><dd className="mt-1">{workspace.courseCount} courses · {workspace.folderCount} folders</dd></div>
      <div><dt className="text-slate-500">Created</dt><dd className="mt-1">{dateLabel(workspace.createdAt)}</dd></div>
      <div><dt className="text-slate-500">Updated</dt><dd className="mt-1">{dateLabel(workspace.updatedAt)}</dd></div>
    </dl></Card>
    <Card className="overflow-hidden"><div className="p-5"><h2 className="text-lg font-semibold">Members ({workspace.memberCount})</h2>{members.length < workspace.memberCount && <p className="mt-1 text-sm text-slate-500">Showing the first {members.length} members.</p>}</div>
      <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Workspace role</TableHead></TableRow></TableHeader><TableBody>{members.map((member) => <TableRow key={member.userId}><TableCell><AdminPrefetchLink href={`/admin/users/${member.userId}`} className="font-medium text-indigo-700 hover:underline">{member.name}</AdminPrefetchLink></TableCell><TableCell>{member.email ?? "No email"}</TableCell><TableCell><StatusBadge status={member.role} /></TableCell></TableRow>)}</TableBody></Table>
    </Card>
    <Card className="overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 p-5"><div><h2 className="text-lg font-semibold">Courses ({workspace.courseCount})</h2><p className="mt-1 text-sm text-slate-500">Includes recently deleted courses.{courses.length < workspace.courseCount && ` Showing the ${courses.length} most recently updated.`}</p></div><AdminPrefetchLink href={`/admin/courses?workspaceId=${workspace.id}`} className={buttonVariants({ size: "sm", variant: "outline" })}>View all courses</AdminPrefetchLink></div>
      <Table><TableHeader><TableRow><TableHead>Course</TableHead><TableHead>Status</TableHead><TableHead>Updated</TableHead></TableRow></TableHeader><TableBody>{courses.map((course) => <TableRow key={course.id}><TableCell>{course.deletedAt ? course.title : <Link href={`/courses/${course.id}/preview`} className="font-medium text-indigo-700 hover:underline">{course.title}</Link>}</TableCell><TableCell><StatusBadge status={course.deletedAt ? "deleted" : course.status} /></TableCell><TableCell className="text-xs text-slate-500">{dateLabel(course.updatedAt)}</TableCell></TableRow>)}</TableBody></Table>
      {!courses.length && <p className="p-6 text-sm text-slate-500">This workspace has no courses.</p>}
    </Card>
    <Card className="overflow-hidden"><div className="p-5"><h2 className="text-lg font-semibold">Pending invitations ({invitationCount})</h2>{invitations.length < invitationCount && <p className="mt-1 text-sm text-slate-500">Showing the {invitations.length} most recent invitations.</p>}</div>
      <Table><TableHeader><TableRow><TableHead>Email</TableHead><TableHead>Workspace role</TableHead><TableHead>Expires</TableHead></TableRow></TableHeader><TableBody>{invitations.map((invitation) => <TableRow key={invitation.id}><TableCell>{invitation.email}</TableCell><TableCell><StatusBadge status={invitation.role} /></TableCell><TableCell className="text-xs text-slate-500">{dateLabel(invitation.expiresAt)}</TableCell></TableRow>)}</TableBody></Table>
      {!invitations.length && <p className="p-6 text-sm text-slate-500">No pending invitations.</p>}
    </Card>
    {selected && <WorkspaceMutationDialog {...selected} onClose={() => setSelected(null)} onSaved={saved} />}
  </div>;
}
