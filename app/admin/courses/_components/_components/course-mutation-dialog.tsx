"use client";

import { useState, type FormEvent } from "react";
import type { AdminCourse } from "@/lib/admin/types";
import type { Permission } from "@/lib/auth/policy";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Notice } from "@/app/admin/_components/shared/admin-common";
import type { useAdminMutation } from "@/app/admin/_components/shared/use-admin-resource";

export function CourseMutationDialog({ course, permissions, mutation, onClose }: { course: AdminCourse; permissions: Permission[]; mutation: ReturnType<typeof useAdminMutation>; onClose: () => void }) {
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
