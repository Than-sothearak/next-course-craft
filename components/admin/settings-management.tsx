"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { AdminLoading } from "./admin-loading";
import { Notice } from "./admin-common";
import { useAdminMutation, useAdminResource } from "./use-admin-resource";

export function SettingsManagement() {
  const resource = useAdminResource<{ aiEnabled: boolean }>("/api/admin/settings");
  const mutation = useAdminMutation(resource.reload);
  const [confirm, setConfirm] = useState(false);
  return <div className="space-y-6"><div><h1 className="text-3xl font-semibold tracking-tight">Platform settings</h1><p className="mt-2 text-slate-500">Protected settings are managed by Super Admin.</p></div><Notice notice={mutation.notice} /><Notice notice={resource.error ? { error: true, message: resource.error } : null} />{resource.loading ? <AdminLoading /> : resource.data && <Card className="max-w-3xl p-6"><div className="flex items-start justify-between gap-6"><div><h2 className="text-lg font-semibold">AI course generation</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">Approved authors also need the AI generation permission. Changing this setting takes effect on subsequent generation requests.</p></div><Checkbox aria-label="AI generation enabled" checked={resource.data.aiEnabled} onChange={() => setConfirm(true)} disabled={mutation.busy} /></div></Card>}
  {confirm && resource.data && <Dialog open title={`${resource.data.aiEnabled ? "Disable" : "Enable"} AI generation?`} onClose={() => setConfirm(false)} busy={mutation.busy}><p className="text-sm leading-6 text-slate-600">This setting applies across Coursecraft. A provider request already in progress may still finish.</p><Notice notice={mutation.notice?.error ? mutation.notice : null} /><div className="mt-6 flex justify-end gap-3"><Button variant="outline" disabled={mutation.busy} onClick={() => setConfirm(false)}>Cancel</Button><Button disabled={mutation.busy} onClick={async () => { if (resource.data && await mutation.mutate("/api/admin/settings", "PUT", { aiEnabled: !resource.data.aiEnabled })) setConfirm(false); }}>{mutation.busy ? "Saving…" : "Confirm change"}</Button></div></Dialog>}
  </div>;
}
