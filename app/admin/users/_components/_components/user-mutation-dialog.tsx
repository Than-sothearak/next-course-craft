"use client";

import { useState, type FormEvent } from "react";
import type { AdminUser } from "@/lib/admin/types";
import { platformRoles, type PlatformRole } from "@/lib/auth/policy";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { dateLabel, Notice, StatusBadge, UserAvatar } from "@/app/admin/_components/shared/admin-common";
import type { useAdminMutation } from "@/app/admin/_components/shared/use-admin-resource";
import { availableActions } from "./user-management-actions";
import type { Authority } from "./user-management-types";

type Mutation = ReturnType<typeof useAdminMutation>;

export function UserMutationDialog({ user, authority, mutation, onClose }: { user: AdminUser; authority: Authority; mutation: Mutation; onClose: () => void }) {
  const actions = availableActions(user, authority);
  const [action, setAction] = useState(actions[0] ?? "approve");
  const [role, setRole] = useState(user.status === "pending" || !platformRoles.includes(user.role as PlatformRole) ? "editor" : user.role);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body: Record<string, unknown> = { action, expectedUpdatedAt: user.updatedAt };
    if (action === "approve" || action === "role") body.role = role;
    if (action === "suspend") body.reason = form.get("reason");
    if (action === "delete") body.confirmEmail = form.get("confirmEmail");
    if (await mutation.mutate(`/api/admin/users/${user.id}`, "PATCH", body)) onClose();
  }
  return <Dialog open title={`Manage ${user.name}`} onClose={onClose} busy={mutation.busy}><form onSubmit={submit} className="space-y-5">
    <div className="flex items-center gap-3"><UserAvatar name={user.name} image={user.image} /><div><p className="font-medium">{user.email ?? user.name}</p><p className="text-sm text-slate-500">Registered {dateLabel(user.createdAt)}</p></div><StatusBadge status={user.status} /></div>
    <label className="block text-sm font-medium">Action<Select aria-label="Action" value={action} onChange={(event) => setAction(event.target.value)} className="mt-2">{actions.map((item) => <option key={item} value={item}>{({ approve: "Approve registration", reject: "Reject registration", role: "Change role", suspend: "Suspend access", reactivate: "Reactivate access", delete: "Remove account access" } as Record<string, string>)[item]}</option>)}</Select></label>
    {(action === "approve" || action === "role") && <label className="block text-sm font-medium">Assigned role<Select aria-label="Assigned role" value={role} onChange={(event) => setRole(event.target.value)} className="mt-2">{(authority.role === "super_admin" ? platformRoles : ["editor", "viewer"]).map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</Select></label>}
    {action === "suspend" && <label className="block text-sm font-medium">Suspension reason<Textarea name="reason" required maxLength={1000} className="mt-2" /></label>}
    {action === "delete" && <><p className="text-sm leading-6 text-slate-600">This removes platform access and retains the account record and its courses for ownership history.</p><label className="block text-sm font-medium">Type {user.email} to confirm<Input name="confirmEmail" type="email" required className="mt-2" autoComplete="off" /></label></>}
    {action === "suspend" && <p className="text-sm text-slate-600">Existing sessions will lose access on their next protected request.</p>}
    <Notice notice={mutation.notice?.error ? mutation.notice : null} />
    <div className="flex justify-end gap-3"><Button variant="outline" onClick={onClose} disabled={mutation.busy}>Cancel</Button><Button type="submit" variant={["reject", "suspend", "delete"].includes(action) ? "destructive" : "default"} disabled={mutation.busy || !actions.length}>{mutation.busy ? "Saving…" : "Confirm change"}</Button></div>
  </form></Dialog>;
}
