"use client";

import { useState, type FormEvent } from "react";
import type { AuditEntry, PageResult } from "@/lib/admin/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminLoading } from "./admin-loading";
import { dateLabel, Notice, Pagination } from "./admin-common";
import { useAdminResource } from "./use-admin-resource";

export function AuditManagement() {
  const [filters, setFilters] = useState({ q: "", action: "", from: "", to: "", page: 1 });
  const resource = useAdminResource<PageResult<AuditEntry>>(`/api/admin/audit-logs?${new URLSearchParams({ ...filters, page: String(filters.page) })}`);
  function filter(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); setFilters({ q: String(form.get("q") ?? ""), action: String(form.get("action") ?? ""), from: String(form.get("from") ?? ""), to: String(form.get("to") ?? ""), page: 1 }); }
  return <div className="space-y-6"><div><h1 className="text-3xl font-semibold tracking-tight">Audit log</h1><p className="mt-2 text-slate-500">A record of account decisions, permission changes, and course administration.</p></div><Notice notice={resource.error ? { error: true, message: resource.error } : null} /><Card className="overflow-hidden"><form onSubmit={filter} className="flex flex-wrap items-end gap-3 border-b p-5"><label className="flex-1 text-xs font-medium text-slate-500">Actor name or email<Input name="q" placeholder="Search actor" maxLength={100} className="mt-2 min-w-44" /></label><label className="text-xs font-medium text-slate-500">Action<Input name="action" placeholder="e.g. users.approve" maxLength={80} className="mt-2 w-48" /></label><label className="text-xs font-medium text-slate-500">From (UTC date)<Input name="from" type="date" className="mt-2" /></label><label className="text-xs font-medium text-slate-500">To (UTC date)<Input name="to" type="date" className="mt-2" /></label><Button type="submit">Filter</Button><Button variant="outline" onClick={resource.reload}>Refresh</Button></form>
  {resource.loading ? <AdminLoading /> : <><Table><TableHeader><TableRow>{["Time", "Actor", "Action", "Target", "Details"].map((label) => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader><TableBody>{resource.data?.items.map((entry) => <TableRow key={entry.id}><TableCell className="whitespace-nowrap text-xs text-slate-500">{dateLabel(entry.createdAt)}</TableCell><TableCell><p className="font-medium">{entry.actorName}</p><p className="mt-1 font-mono text-[10px] text-slate-400">{entry.actorId}</p></TableCell><TableCell className="font-mono text-xs">{entry.action}</TableCell><TableCell><p>{entry.targetType}</p><p className="mt-1 font-mono text-[10px] text-slate-400">{entry.targetId ?? "Platform"}</p></TableCell><TableCell><details><summary className="cursor-pointer text-xs font-medium text-indigo-600">View changes</summary><pre className="mt-3 max-w-md whitespace-pre-wrap break-all rounded-lg bg-slate-50 p-3 text-[11px] leading-5">{JSON.stringify(entry.metadata, null, 2)}</pre></details></TableCell></TableRow>)}</TableBody></Table>{resource.data?.total === 0 && <p className="p-10 text-center text-sm text-slate-500">No audit events match your filters.</p>}{resource.data && <Pagination {...resource.data} onPage={(page) => setFilters((old) => ({ ...old, page }))} />}</>}
  </Card></div>;
}
