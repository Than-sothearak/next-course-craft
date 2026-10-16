"use client";

import { useState, type FormEvent } from "react";
import type { CourseAssignments } from "@/lib/admin/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminLoading } from "./admin-loading";
import { Notice, StatusBadge } from "./admin-common";
import { useAdminMutation, useAdminResource } from "./use-admin-resource";

export function CourseAccessManager({ courseId }: { courseId: string }) {
  const url = `/api/courses/${courseId}/assignments`;
  const resource = useAdminResource<CourseAssignments>(url);
  const mutation = useAdminMutation(resource.reload);
  const [removing, setRemoving] = useState<CourseAssignments["assignments"][number] | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    if (await mutation.mutate(url, "PUT", { email: data.get("email"), role: data.get("role") })) form.reset();
  }
  return <div className="space-y-6"><Notice notice={mutation.notice} /><Notice notice={resource.error ? { error: true, message: resource.error } : null} />
    <Card className="p-6"><h2 className="text-lg font-semibold">Invite a course collaborator</h2><p className="mt-2 text-sm leading-6 text-slate-500">Use an approved account’s email. Editors can edit and use their permitted authoring tools; viewers can preview only. The account’s platform permissions still apply.</p><form onSubmit={submit} className="mt-5 flex flex-wrap gap-3"><Input name="email" aria-label="Collaborator email" placeholder="person@example.com" type="email" required className="min-w-48 flex-1" /><Select name="role" aria-label="Course assignment role" defaultValue="viewer" className="w-40"><option value="viewer">Viewer</option><option value="editor">Editor</option></Select><Button type="submit" disabled={mutation.busy}>{mutation.busy ? "Saving…" : "Assign access"}</Button></form></Card>
    {resource.loading ? <AdminLoading /> : resource.data && <Card className="overflow-hidden"><div className="border-b p-6"><h2 className="text-lg font-semibold">Course access</h2><p className="mt-2 text-sm text-slate-500">Owner: {resource.data.owner.name} · {resource.data.owner.email}</p><p className="mt-2 text-xs leading-5 text-slate-400">Existing team workspace membership also grants access. Removing a course assignment does not revoke workspace membership.</p></div><Table><TableHeader><TableRow><TableHead>Collaborator</TableHead><TableHead>Course role</TableHead><TableHead>Account status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader><TableBody>{resource.data.assignments.map((assignment) => <TableRow key={assignment.userId}><TableCell><p className="font-medium">{assignment.name}</p><p className="text-xs text-slate-500">{assignment.email}</p></TableCell><TableCell className="capitalize">{assignment.role}</TableCell><TableCell><StatusBadge status={assignment.status} /></TableCell><TableCell><Button size="sm" variant="ghost" disabled={mutation.busy} onClick={() => setRemoving(assignment)}>Remove</Button></TableCell></TableRow>)}</TableBody></Table>{!resource.data.assignments.length && <p className="p-8 text-center text-sm text-slate-500">No explicit course assignments yet.</p>}</Card>}
    {removing && <Dialog open title="Remove course assignment?" onClose={() => setRemoving(null)} busy={mutation.busy}><p className="text-sm leading-6 text-slate-600">Remove the direct course assignment for {removing.email ?? removing.name}? Workspace access, if any, is managed separately.</p><Notice notice={mutation.notice?.error ? mutation.notice : null} /><div className="mt-6 flex justify-end gap-3"><Button variant="outline" disabled={mutation.busy} onClick={() => setRemoving(null)}>Cancel</Button><Button variant="destructive" disabled={mutation.busy} onClick={async () => { if (await mutation.mutate(url, "DELETE", { userId: removing.userId })) setRemoving(null); }}>{mutation.busy ? "Removing…" : "Remove assignment"}</Button></div></Dialog>}
  </div>;
}
