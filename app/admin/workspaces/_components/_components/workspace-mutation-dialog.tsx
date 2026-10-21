"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Notice } from "@/app/admin/_components/shared/admin-common";
import { useAdminMutation } from "@/app/admin/_components/shared/use-admin-resource";
import type { WorkspaceAction } from "./workspace-management-types";

export function WorkspaceMutationDialog({ workspace, action, onClose, onSaved }: WorkspaceAction & { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(workspace.name);
  const [confirmation, setConfirmation] = useState("");
  const mutation = useAdminMutation(onSaved);
  const deleting = action === "delete";
  const empty = workspace.courseCount === 0 && workspace.folderCount === 0;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await mutation.mutate(`/api/admin/workspaces/${workspace.id}`, deleting ? "DELETE" : "PATCH", {
      ...(deleting ? { confirmName: confirmation } : { name: name.trim() }),
      expectedUpdatedAt: workspace.updatedAt,
    });
  }

  return <Dialog open title={deleting ? "Delete workspace" : "Update workspace"} onClose={onClose} busy={mutation.busy}>
    <form onSubmit={submit} className="space-y-5">
      <div><p className="break-words font-medium">{workspace.name}</p><p className="mt-1 break-words text-sm text-slate-500">Owned by {workspace.ownerName} · {workspace.ownerEmail ?? workspace.ownerId}</p></div>
      {deleting ? <>
        <p className="rounded-lg bg-rose-50 p-4 text-sm leading-6 text-rose-900">Only empty workspaces can be deleted. The workspace and its memberships and invitations will be permanently removed.</p>
        {!empty && <p role="alert" className="text-sm text-rose-700">This workspace has {workspace.courseCount} courses and {workspace.folderCount} folders. Move all courses (including recently deleted courses) out and remove all folders before deleting it.</p>}
        <label htmlFor="workspace-confirmation" className="block text-sm font-medium">Type the workspace name exactly to confirm
          <Input id="workspace-confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required maxLength={120} autoComplete="off" className="mt-2" disabled={mutation.busy || !empty} />
        </label>
      </> : <label htmlFor="workspace-name" className="block text-sm font-medium">Workspace name
        <Input id="workspace-name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} className="mt-2" disabled={mutation.busy} />
      </label>}
      <Notice notice={mutation.notice?.error ? mutation.notice : null} />
      <div className="flex justify-end gap-3"><Button variant="outline" onClick={onClose} disabled={mutation.busy}>Cancel</Button><Button type="submit" variant={deleting ? "destructive" : "default"} disabled={mutation.busy || (deleting ? !empty || confirmation !== workspace.name : !name.trim() || name.trim() === workspace.name)}>{mutation.busy ? "Saving…" : deleting ? "Delete workspace" : "Save changes"}</Button></div>
    </form>
  </Dialog>;
}
