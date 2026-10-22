"use client";

import { AdminPrefetchLink } from "@/app/admin/_components/shared/admin-prefetch-link";
import { useState, type FormEvent } from "react";
import type { AdminWorkspace, PageResult } from "@/lib/admin/types";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminLoading } from "@/app/admin/_components/admin-loading";
import { dateLabel, Notice, Pagination } from "@/app/admin/_components/shared/admin-common";
import { useAdminResource } from "@/app/admin/_components/shared/use-admin-resource";
import { WorkspaceMutationDialog } from "./_components/workspace-mutation-dialog";
import type { WorkspaceAction } from "./_components/workspace-management-types";

export function WorkspaceManagement() {
  const [filters, setFilters] = useState({ page: 1, q: "" });
  const [selected, setSelected] = useState<WorkspaceAction | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const resource = useAdminResource<PageResult<AdminWorkspace>>(`/api/admin/workspaces?${new URLSearchParams({ q: filters.q, page: String(filters.page) })}`);

  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFilters({ page: 1, q: String(new FormData(event.currentTarget).get("q") ?? "") });
  }

  function saved() {
    setMessage(selected?.action === "delete" ? "Workspace deleted." : "Workspace updated.");
    if (selected?.action === "delete") setFilters((old) => ({ ...old, page: 1 }));
    setSelected(null);
    resource.reload();
  }

  return <div className="space-y-6">
    <div><h1 className="text-3xl font-semibold tracking-tight">Workspace management</h1><p className="mt-2 text-slate-500">View team workspaces, update their names, and delete empty workspaces across the platform.</p></div>
    <Notice notice={message ? { error: false, message } : null} />
    <Notice notice={resource.error ? { error: true, message: resource.error } : null} />
    <Card className="overflow-hidden">
      <form onSubmit={filter} className="flex flex-wrap gap-3 border-b p-5">
        <Input name="q" aria-label="Search workspaces or owners" placeholder="Search workspaces or owners" maxLength={100} className="min-w-48 flex-1" />
        <Button type="submit">Search</Button><Button variant="outline" onClick={resource.reload}>Refresh</Button>
      </form>
      {resource.loading ? <AdminLoading /> : <>
        <Table><TableHeader><TableRow>{["Workspace", "Owner", "Members", "Courses", "Folders", "Updated", "Actions"].map((label) => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader>
          <TableBody>{resource.data?.items.map((workspace) => <TableRow key={workspace.id}>
            <TableCell className="min-w-48"><AdminPrefetchLink href={`/admin/workspaces/${workspace.id}`} className="font-medium text-indigo-700 hover:underline">{workspace.name}</AdminPrefetchLink></TableCell>
            <TableCell><p>{workspace.ownerName}</p><p className="text-xs text-slate-500">{workspace.ownerEmail ?? workspace.ownerId}</p></TableCell>
            <TableCell>{workspace.memberCount}</TableCell><TableCell>{workspace.courseCount}</TableCell><TableCell>{workspace.folderCount}</TableCell>
            <TableCell className="whitespace-nowrap text-xs text-slate-500">{dateLabel(workspace.updatedAt)}</TableCell>
            <TableCell><div className="flex flex-wrap gap-2">
              <AdminPrefetchLink href={`/admin/workspaces/${workspace.id}`} className={buttonVariants({ size: "sm", variant: "ghost" })}>View</AdminPrefetchLink>
              <Button size="sm" variant="outline" onClick={() => setSelected({ workspace, action: "update" })}>Update</Button>
              <Button size="sm" variant="destructive" onClick={() => setSelected({ workspace, action: "delete" })}>Delete</Button>
            </div></TableCell>
          </TableRow>)}</TableBody>
        </Table>
        {resource.data?.total === 0 && <p className="p-10 text-center text-sm text-slate-500">No workspaces match your search.</p>}
        {resource.data && <Pagination {...resource.data} onPage={(page) => setFilters((old) => ({ ...old, page }))} />}
      </>}
    </Card>
    {selected && <WorkspaceMutationDialog {...selected} onClose={() => setSelected(null)} onSaved={saved} />}
  </div>;
}
