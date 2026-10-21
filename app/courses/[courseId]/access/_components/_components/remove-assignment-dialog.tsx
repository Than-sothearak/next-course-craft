"use client";

import type { CourseAssignments } from "@/lib/admin/types";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Notice } from "@/app/admin/_components/shared/admin-common";
import type { useAdminMutation } from "@/app/admin/_components/shared/use-admin-resource";

export function RemoveAssignmentDialog({ assignment, url, mutation, onClose }: { assignment: CourseAssignments["assignments"][number]; url: string; mutation: ReturnType<typeof useAdminMutation>; onClose: () => void }) {
  return <Dialog open title="Remove course assignment?" onClose={onClose} busy={mutation.busy}><p className="text-sm leading-6 text-slate-600">Remove the direct course assignment for {assignment.email ?? assignment.name}? Workspace access, if any, is managed separately.</p><Notice notice={mutation.notice?.error ? mutation.notice : null} /><div className="mt-6 flex justify-end gap-3"><Button variant="outline" disabled={mutation.busy} onClick={onClose}>Cancel</Button><Button variant="destructive" disabled={mutation.busy} onClick={async () => { if (await mutation.mutate(url, "DELETE", { userId: assignment.userId })) onClose(); }}>{mutation.busy ? "Removing…" : "Remove assignment"}</Button></div></Dialog>;
}
