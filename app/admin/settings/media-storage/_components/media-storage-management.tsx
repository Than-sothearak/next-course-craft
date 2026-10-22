"use client";

import { AdminPrefetchLink } from "@/app/admin/_components/shared/admin-prefetch-link";
import { useEffect, useState } from "react";
import { Cloud, HardDrive, LoaderCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Radio } from "@/components/ui/radio";
import type { MediaStorageSettings } from "@/lib/media/settings-schema";
import { AdminLoading } from "@/app/admin/_components/admin-loading";
import { Notice } from "@/app/admin/_components/shared/admin-common";
import { useAdminResource } from "@/app/admin/_components/shared/use-admin-resource";
import { ServerFolderDialog } from "./_components/server-folder-dialog";
import { formatStorageBytes } from "./_components/format-storage-bytes";

const endpoint = "/api/admin/settings/media-storage";
type Provider = MediaStorageSettings["provider"];
type NoticeValue = { error: boolean; message: string } | null;

export function MediaStorageManagement() {
  const [directorySelection, setDirectorySelection] = useState<string | null>(null);
  const resource = useAdminResource<MediaStorageSettings>(endpoint);
  const [capacityResult, setCapacityResult] = useState<{ directory: string; capacity: MediaStorageSettings["local"]["capacity"] } | null>(null);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [selection, setSelection] = useState<Provider | null>(null);
  const [busy, setBusy] = useState<"test" | "save" | null>(null);
  const [notice, setNotice] = useState<NoticeValue>(null);
  const [test, setTest] = useState<{ provider: Provider; ok: boolean; checkedAt: string } | null>(null);
  const selected = selection ?? resource.data?.provider ?? "s3";
  const directory = directorySelection ?? resource.data?.local.directory ?? null;
  const capacity = directorySelection
    ? (capacityResult?.directory === directorySelection ? capacityResult.capacity : null)
    : resource.data?.local.capacity ?? null;
  const capacityLoading = directorySelection !== null && capacityResult?.directory !== directorySelection;
  const usableCapacityBytes = capacity ? capacity.usedBytes + capacity.freeBytes : 0;
  const usedVolumePercent = usableCapacityBytes > 0 && capacity
    ? capacity.usedBytes / usableCapacityBytes * 100
    : 0;

  useEffect(() => {
    if (!directorySelection) return;
    const controller = new AbortController();
    fetch(`${endpoint}?localDirectory=${encodeURIComponent(directorySelection)}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not read local storage capacity.");
        return result as MediaStorageSettings;
      })
      .then((settings) => { if (!controller.signal.aborted) setCapacityResult({ directory: directorySelection, capacity: settings.local.capacity }); })
      .catch(() => { if (!controller.signal.aborted) setCapacityResult({ directory: directorySelection, capacity: null }); });
    return () => controller.abort();
  }, [directorySelection]);

  async function submit(action: "test" | "save") {
    if (!resource.data || busy) return;
    setBusy(action);
    setNotice(null);
    try {
      const target = { provider: selected, ...(selected === "local" && directory ? { localDirectory: directory } : {}) };
      const response = await fetch(action === "test" ? `${endpoint}/test` : endpoint, {
        method: action === "test" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "test" ? target : { ...target, revision: resource.data.revision }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The storage request failed.");
      setTest({ provider: selected, ok: true, checkedAt: new Date().toLocaleTimeString() });
      setNotice({ error: false, message: action === "test" ? "Connection verified: upload, metadata, read, and delete checks passed. Settings have not changed." : "Media storage settings saved. New uploads will use the selected provider." });
      if (action === "save") { setSelection(null); setDirectorySelection(null); resource.reload(); }
    } catch (error) {
      setTest({ provider: selected, ok: false, checkedAt: new Date().toLocaleTimeString() });
      setNotice({ error: true, message: error instanceof Error ? error.message : "The storage request failed." });
    } finally { setBusy(null); }
  }

  return <div className="max-w-4xl space-y-6">
    <div><AdminPrefetchLink href="/admin/settings" className="text-sm text-indigo-700 hover:underline">Settings</AdminPrefetchLink><h1 className="mt-3 text-3xl font-semibold tracking-tight">Media Storage</h1><p className="mt-2 text-sm leading-6 text-slate-500">Super Admin controls storage for new uploads. Existing media stays in its original location.</p></div>
    <Notice notice={notice} />
    <Notice notice={resource.error ? { error: true, message: resource.error } : null} />
    {resource.error && <Button variant="outline" onClick={resource.reload}>Reload settings</Button>}
    {resource.loading ? <AdminLoading /> : resource.data && <>
      <p className="text-sm text-slate-600">Currently active: <strong>{resource.data.provider === "local" ? "Local Server" : "AWS S3"}</strong></p>
      <fieldset disabled={busy !== null} className="space-y-3"><legend className="mb-3 text-sm font-semibold">Select storage provider</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {(["local", "s3"] as const).map((provider) => {
            const Icon = provider === "local" ? HardDrive : Cloud;
            return <Card key={provider} className={selected === provider ? "border-indigo-500 ring-1 ring-indigo-500" : ""}>
              <label className="flex h-full cursor-pointer items-start gap-3 p-5">
                <Radio name="storage-provider" value={provider} checked={selected === provider} onChange={() => { setSelection(provider); setNotice(null); if (provider === "local") setFolderDialogOpen(true); }} className="mt-1 size-4 accent-indigo-600" />
                <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><Icon size={20} /><span className="font-semibold">{provider === "local" ? "Local Server" : "AWS S3"}</span>{resource.data?.provider === provider && <Badge variant="success">Active</Badge>}</span><span className="mt-2 block text-sm leading-6 text-slate-500">{provider === "local" ? "Private files on your server’s persistent storage volume." : "Private files in your configured Amazon S3 bucket."}</span></span>
              </label>
            </Card>;
          })}
        </div>
      </fieldset>
      <Card className="space-y-4 p-5 sm:p-6">
        <h2 className="font-semibold">{selected === "local" ? "Local storage configuration" : "S3 configuration"}</h2>
        {selected === "local" ? <>
          <div><label htmlFor="media-directory" className="text-sm font-medium">Storage directory</label><Input id="media-directory" readOnly value={directory ?? "Not configured"} className="mt-2" /><Button variant="outline" className="mt-3" disabled={busy !== null} onClick={() => setFolderDialogOpen(true)}>Choose folder…</Button></div>
          <div className="space-y-2" aria-label="Local storage capacity">
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm"><span className="font-medium">Free space on this volume</span><span className="font-semibold text-slate-900">{capacity ? `${formatStorageBytes(capacity.freeBytes)} free` : capacityLoading ? "Checking…" : "Unavailable"}</span></div>
            {capacity ? <><Progress aria-label="Used local storage volume" aria-valuetext={`${formatStorageBytes(capacity.usedBytes)} used, ${formatStorageBytes(capacity.freeBytes)} free of ${formatStorageBytes(capacity.totalBytes)} total volume`} value={usedVolumePercent} /><p className="text-xs text-slate-500">{formatStorageBytes(capacity.usedBytes)} used and {formatStorageBytes(capacity.freeBytes)} free of {formatStorageBytes(capacity.totalBytes)} total volume</p></> : !capacityLoading && <p className="text-sm leading-6 text-slate-500">Free-space information is unavailable. Check the selected folder and server volume.</p>}
          </div>
          <p className="text-sm leading-6 text-slate-500">Choose a storage folder on the server. New uploads use this folder after you save; existing files stay in their original folders. Use persistent storage and include every media folder in backups.</p>
        </> : <div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor="media-bucket" className="text-sm font-medium">Bucket</label><Input id="media-bucket" readOnly value={resource.data.s3.bucket ?? "Not configured"} className="mt-2" /></div><div><label htmlFor="media-region" className="text-sm font-medium">Region</label><Input id="media-region" readOnly value={resource.data.s3.region ?? "Not configured"} className="mt-2" /></div><p className="text-sm leading-6 text-slate-500 sm:col-span-2">Bucket, region, and credentials are managed in the server environment or through an IAM role. AWS S3 has no fixed bucket capacity to show as free space; review your AWS account limits and usage. Keep this bucket available for existing S3 files.</p></div>}
        <p role="status" className="text-sm text-slate-600">{selected === "local" ? "Writable-directory test" : "Connection status"}: {test?.provider === selected ? `${test.ok ? "Passed" : "Failed"} at ${test.checkedAt}` : "Not tested in this session"}</p>
      </Card>
      <p className="text-sm leading-6 text-slate-500">Saving tests the selected provider again before activation. Switching providers does not move or delete files.</p>
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end"><Button variant="outline" disabled={busy !== null} onClick={() => void submit("test")}>{busy === "test" && <LoaderCircle size={16} className="animate-spin" />}{busy === "test" ? "Testing…" : "Test Connection"}</Button><Button disabled={busy !== null} onClick={() => void submit("save")}>{busy === "save" && <LoaderCircle size={16} className="animate-spin" />}{busy === "save" ? "Testing and saving…" : "Save Settings"}</Button></div>
    </>}
    {folderDialogOpen && <ServerFolderDialog initialPath={directory} onClose={() => setFolderDialogOpen(false)} onSelect={(path) => { setDirectorySelection(path); setTest(null); setNotice(null); setFolderDialogOpen(false); }} />}
  </div>;
}
