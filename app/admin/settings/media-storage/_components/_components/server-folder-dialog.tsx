"use client";

import { useState } from "react";
import { ArrowUp, Folder, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { MediaStorageFolders } from "@/lib/media/settings-schema";
import { Notice } from "@/app/admin/_components/shared/admin-common";
import { useAdminResource } from "@/app/admin/_components/shared/use-admin-resource";

export function ServerFolderDialog({ initialPath, onClose, onSelect }: {
  initialPath: string | null; onClose: () => void; onSelect: (path: string) => void;
}) {
  const [path, setPath] = useState(initialPath);
  const query = new URLSearchParams(path ? { path } : {});
  const resource = useAdminResource<MediaStorageFolders>(`/api/admin/settings/media-storage/folders?${query}`);
  return <Dialog open title="Choose storage folder" onClose={onClose} footer={<>
    <Button variant="outline" onClick={onClose}>Cancel</Button>
    <Button disabled={!resource.data || resource.loading} onClick={() => { if (resource.data) onSelect(resource.data.path); }}>Use this folder</Button>
  </>}>
    <p className="text-sm leading-6 text-slate-500">Choose a folder on the computer running CourseCraft. On a hosted installation, these are the server’s folders.</p>
    <div className="my-4 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => setPath(null)}>Storage folders</Button><Button size="sm" variant="outline" disabled={!resource.data?.parent || resource.loading} onClick={() => setPath(resource.data?.parent ?? null)}><ArrowUp size={16} />Parent folder</Button></div>
    <Notice notice={resource.error ? { error: true, message: resource.error } : null} />
    {resource.error && <Button variant="outline" size="sm" onClick={resource.reload}>Retry</Button>}
    {resource.loading ? <p role="status" className="flex items-center gap-2 py-8 text-sm text-slate-500"><LoaderCircle size={16} className="animate-spin" />Loading folders…</p> : resource.data && <>
      <p className="mb-3 break-all rounded-lg bg-slate-50 p-3 text-sm" aria-label="Current folder">{resource.data.path}</p>
      <ul aria-label="Server folders" className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
        {resource.data.folders.map((folder) => <li key={folder.path}><Button variant="ghost" className="h-auto w-full justify-start whitespace-normal text-left" onClick={() => setPath(folder.path)}><Folder size={18} className="shrink-0 text-indigo-500" /><span className="min-w-0 break-all">{folder.name}</span></Button></li>)}
        {!resource.data.folders.length && <li className="p-4 text-sm text-slate-500">No subfolders. You can use this folder.</li>}
      </ul>
      {resource.data.truncated && <p className="mt-3 text-sm text-slate-500">This folder has too many entries to display them all. Choose a smaller folder or use the current folder.</p>}
      <p className="mt-3 text-xs text-slate-500">Browsing is limited to {resource.data.root}. The folder is tested when you save.</p>
    </>}
  </Dialog>;
}
