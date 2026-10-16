"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Copy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { DashboardWorkspace } from "@/lib/dashboard/types";

type WorkspaceRoster = {
  workspace: { id: string; name: string; role: DashboardWorkspace["role"] };
  members: Array<{ userId: string; name: string; email: string | null; role: DashboardWorkspace["role"] }>;
  invitations: Array<{ id: string; email: string; role: Exclude<DashboardWorkspace["role"], "owner">; expiresAt: string }>;
};

async function responseError(response: Response) {
  try {
    const body = await response.json() as { error?: string };
    return body.error ?? "The request could not be completed.";
  } catch {
    return "The request could not be completed.";
  }
}

export function WorkspaceManagerDialog({
  open,
  workspaceId,
  role,
  onClose,
  onCreated,
}: {
  open: boolean;
  workspaceId: string | null;
  role: DashboardWorkspace["role"];
  onClose: () => void;
  onCreated: (workspace: DashboardWorkspace) => void;
}) {
  const [roster, setRoster] = useState<WorkspaceRoster | null>(null);
  const [invitePath, setInvitePath] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function refreshRoster(signal?: AbortSignal) {
    if (!workspaceId) return;
    const response = await fetch(`/api/workspaces/${workspaceId}/invitations`, { cache: "no-store", signal });
    if (!response.ok) throw new Error(await responseError(response));
    setRoster(await response.json() as WorkspaceRoster);
  }

  useEffect(() => {
    if (!open || !workspaceId || (role !== "owner" && role !== "admin")) {
      return;
    }
    const controller = new AbortController();
    void fetch(`/api/workspaces/${workspaceId}/invitations`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(await responseError(response));
        return response.json() as Promise<WorkspaceRoster>;
      })
      .then(setRoster)
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Team details are unavailable.");
      });
    return () => controller.abort();
  }, [open, workspaceId, role]);

  if (!open) return null;

  async function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const name = new FormData(event.currentTarget).get("name");
      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      onCreated(await response.json() as DashboardWorkspace);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the workspace.");
    } finally {
      setBusy(false);
    }
  }

  async function createInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceId) return;
    const form = event.currentTarget;
    setBusy(true);
    setError("");
    setInvitePath("");
    setCopied(false);
    try {
      const formData = new FormData(form);
      const response = await fetch(`/api/workspaces/${workspaceId}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.get("email"), role: formData.get("role") }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      const result = await response.json() as { invitePath: string };
      setInvitePath(`${window.location.origin}${result.invitePath}`);
      form.reset();
      await refreshRoster();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the invitation.");
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(memberId: string) {
    if (!workspaceId) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/members/${memberId}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await responseError(response));
      await refreshRoster();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not remove the member.");
    } finally {
      setBusy(false);
    }
  }

  async function updateMemberRole(memberId: string, nextRole: string) {
    if (!workspaceId) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: nextRole }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      await refreshRoster();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update the member role.");
      await refreshRoster().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  async function revokeInvitation(invitationId: string) {
    if (!workspaceId) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/invitations/${invitationId}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await responseError(response));
      await refreshRoster();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not revoke the invitation.");
    } finally {
      setBusy(false);
    }
  }

  const canManage = role === "owner" || role === "admin";
  return (
    <div className="dialog-backdrop-in fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/35 p-4 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }} onKeyDown={(event) => { if (event.key === "Escape") onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="workspace-dialog-title" className="dialog-panel-in my-6 max-h-[calc(100vh-3rem)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-7">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-indigo-700">Team collaboration</p>
            <h2 id="workspace-dialog-title" className="mt-1 text-xl font-semibold tracking-tight">{workspaceId ? roster?.workspace.name ?? "Manage workspace" : "Create a team workspace"}</h2>
            <p className="mt-1 text-sm text-slate-500">Invite people to build and manage courses together.</p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close workspace dialog"><X size={18} /></Button>
        </div>

        {!workspaceId ? (
          <form onSubmit={createWorkspace} className="space-y-4">
            <label className="block text-sm font-medium text-slate-700">Workspace name<Input name="name" required maxLength={120} autoFocus placeholder="e.g. Product education" className="mt-1.5 font-normal" /></label>
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">Your personal courses stay private. Courses and folders you create in this workspace are available to its members.</p>
            {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? "Creating…" : "Create workspace"}</Button></div>
          </form>
        ) : (
          <div className="space-y-6">
            {canManage && <form onSubmit={createInvitation} className="space-y-3 rounded-xl border border-slate-200 p-4">
              <h3 className="font-semibold">Invite a teammate</h3>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px_auto]">
                <label className="text-xs font-medium text-slate-600">Email address<Input name="email" type="email" required maxLength={254} placeholder="teammate@example.com" className="mt-1 h-10 text-sm font-normal" /></label>
                <label className="text-xs font-medium text-slate-600">Role<Select name="role" defaultValue="editor" className="mt-1 h-10 text-sm font-normal"><option value="editor">Editor</option><option value="viewer">Viewer</option>{role === "owner" && <option value="admin">Admin</option>}</Select></label>
                <Button type="submit" disabled={busy} className="self-end">Create invite</Button>
              </div>
              {invitePath && <div className="space-y-2 rounded-lg bg-indigo-50 p-3"><p className="text-xs font-medium text-indigo-900">Copy this link and send it to the invited teammate. It expires in 7 days and only works for the invited email.</p><div className="flex gap-2"><Input readOnly value={invitePath} aria-label="Workspace invitation link" className="min-w-0 bg-white text-xs" /><Button type="button" variant="outline" size="icon" aria-label="Copy invitation link" onClick={() => { void navigator.clipboard.writeText(invitePath).then(() => setCopied(true)); }}><Copy size={15} /></Button></div>{copied && <p role="status" className="text-xs text-indigo-800">Invitation link copied.</p>}</div>}
            </form>}

            {canManage ? <section>
              <h3 className="mb-2 font-semibold">Members <span className="text-sm font-normal text-slate-500">({roster?.members.length ?? 0})</span></h3>
              {roster ? <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">{roster.members.map((member) => <li key={member.userId} className="flex items-center justify-between gap-3 px-4 py-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{member.name}</p><p className="truncate text-xs text-slate-500">{member.email ?? "No email"}</p></div>{member.role === "owner" || (member.role === "admin" && role !== "owner") ? <span className="text-xs font-semibold capitalize text-slate-500">{member.role}</span> : <div className="flex shrink-0 items-center gap-2"><Select value={member.role} disabled={busy} onChange={(event) => void updateMemberRole(member.userId, event.target.value)} aria-label={`Role for ${member.name}`} className="h-9 w-28 text-xs"><option value="editor">Editor</option><option value="viewer">Viewer</option>{role === "owner" && <option value="admin">Admin</option>}</Select><Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void removeMember(member.userId)} className="text-rose-700">Remove</Button></div>}</li>)}</ul> : <p className="text-sm text-slate-500">Loading members…</p>}
            </section> : <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">You have {role} access to this workspace.</p>}

            {canManage && roster?.invitations.length ? <section>
              <h3 className="mb-2 font-semibold">Pending invitations</h3>
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">{roster.invitations.map((invitation) => <li key={invitation.id} className="flex items-center justify-between gap-3 px-4 py-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{invitation.email}</p><p className="text-xs text-slate-500">{invitation.role} · expires {new Date(invitation.expiresAt).toLocaleDateString()}</p></div><Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void revokeInvitation(invitation.id)} className="shrink-0 text-rose-700">Revoke</Button></li>)}</ul>
            </section> : null}
            {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
            <div className="flex justify-end border-t border-slate-100 pt-4"><Button type="button" variant="outline" onClick={onClose}>Done</Button></div>
          </div>
        )}
      </section>
    </div>
  );
}
