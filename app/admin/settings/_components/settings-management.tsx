"use client";

import { useState } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { AdminLoading } from "@/app/admin/_components/admin-loading";
import { Notice } from "@/app/admin/_components/shared/admin-common";
import { useAdminMutation, useAdminResource } from "@/app/admin/_components/shared/use-admin-resource";
import { AiSettingsDialog } from "./_components/ai-settings-dialog";

export function SettingsManagement() {
  const resource = useAdminResource<{ aiEnabled: boolean }>("/api/admin/settings");
  const mutation = useAdminMutation(resource.reload);
  const [confirm, setConfirm] = useState(false);
  return <div className="space-y-6"><div><h1 className="text-3xl font-semibold tracking-tight">Platform settings</h1><p className="mt-2 text-slate-500">Protected settings are managed by Super Admin.</p></div><Notice notice={mutation.notice} /><Notice notice={resource.error ? { error: true, message: resource.error } : null} />{resource.loading ? <AdminLoading /> : resource.data && <Card className="max-w-3xl p-6"><div className="flex items-start justify-between gap-6"><div><h2 className="text-lg font-semibold">AI course generation</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">Approved authors also need the AI generation permission. Changing this setting takes effect on subsequent generation requests.</p></div><Checkbox aria-label="AI generation enabled" checked={resource.data.aiEnabled} onChange={() => setConfirm(true)} disabled={mutation.busy} /></div></Card>}
  <Card className="max-w-3xl p-6"><h2 className="text-lg font-semibold">Media Storage</h2><p className="mb-4 mt-2 text-sm leading-6 text-slate-500">Choose Local Server or AWS S3 for new uploads and test the storage connection.</p><Link href="/admin/settings/media-storage" className={buttonVariants({ variant: "outline" })}>Manage media storage</Link></Card>
  {confirm && resource.data && <AiSettingsDialog aiEnabled={resource.data.aiEnabled} mutation={mutation} onClose={() => setConfirm(false)} />}
  </div>;
}
