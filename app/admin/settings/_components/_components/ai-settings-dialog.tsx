"use client";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Notice } from "@/app/admin/_components/shared/admin-common";
import type { useAdminMutation } from "@/app/admin/_components/shared/use-admin-resource";

export function AiSettingsDialog({ aiEnabled, mutation, onClose }: { aiEnabled: boolean; mutation: ReturnType<typeof useAdminMutation>; onClose: () => void }) {
  return <Dialog open title={`${aiEnabled ? "Disable" : "Enable"} AI generation?`} onClose={onClose} busy={mutation.busy}><p className="text-sm leading-6 text-slate-600">This setting applies across Coursecraft. A provider request already in progress may still finish.</p><Notice notice={mutation.notice?.error ? mutation.notice : null} /><div className="mt-6 flex justify-end gap-3"><Button variant="outline" disabled={mutation.busy} onClick={onClose}>Cancel</Button><Button disabled={mutation.busy} onClick={async () => { if (await mutation.mutate("/api/admin/settings", "PUT", { aiEnabled: !aiEnabled })) onClose(); }}>{mutation.busy ? "Saving…" : "Confirm change"}</Button></div></Dialog>;
}
