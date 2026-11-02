"use client";

import { useId, useState, type FormEvent } from "react";
import { Folder, FolderInput, MoreHorizontal, Trash2 } from "lucide-react";
import type { DashboardData, DashboardFolder } from "@/lib/dashboard/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover } from "@/components/ui/popover";
import { Select } from "@/components/ui/select";
import { DashboardLink } from "../dashboard-link";

export function FolderCard({ folder, data, disabled, busy, error, href, onSubmit, onRequest }: {
  folder: DashboardFolder;
  data: DashboardData;
  disabled: boolean;
  busy: boolean;
  error?: string | null;
  href: string;
  onSubmit: (event: FormEvent<HTMLFormElement>, url: string, method: string) => Promise<void>;
  onRequest: (url: string, method: string, body?: unknown) => Promise<void>;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const unavailable = disabled || busy;
  return (
    <Card className="group min-w-0 rounded-2xl p-4 shadow-[0_2px_8px_rgba(15,23,42,0.03)] transition hover:border-indigo-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <DashboardLink href={href} className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
          <Folder size={20} aria-hidden="true" className="shrink-0" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-slate-800">{folder.name}</span>
            <span className="mt-1 block text-xs text-slate-500">{folder.courseCount} courses</span>
          </span>
        </DashboardLink>
        {data.permissions?.includes("courses.edit") && data.workspaceRole !== "viewer" && <Popover
          open={open}
          onOpenChange={setOpen}
          title="Folder settings"
          triggerLabel={`Manage ${folder.name}`}
          trigger={<MoreHorizontal size={18} aria-hidden="true" />}
          disabled={unavailable}
          busy={busy}
        >
          <div className="space-y-4">
            {error && <p role="alert" className="rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700">{error}</p>}
            <form onSubmit={(event) => onSubmit(event, `/api/folders/${folder.id}`, "PATCH")}>
              <label htmlFor={`${id}-name`} className="mb-1.5 block text-xs font-medium text-slate-600">Rename folder</label>
              <div className="flex gap-2">
                <Input id={`${id}-name`} name="name" required maxLength={120} defaultValue={folder.name} disabled={unavailable} className="h-9 min-w-0" />
                <Button type="submit" size="sm" disabled={unavailable}>Save name</Button>
              </div>
            </form>
            <form onSubmit={(event) => onSubmit(event, `/api/folders/${folder.id}`, "PATCH")} className="border-t border-slate-100 pt-3">
              <label htmlFor={`${id}-parent`} className="mb-1.5 block text-xs font-medium text-slate-600">Move folder</label>
              <div className="flex gap-2">
                <Select id={`${id}-parent`} name="parentId" defaultValue={folder.parentId ?? ""} disabled={unavailable} className="h-9 min-w-0 flex-1">
                  <option value="">All courses</option>
                  {data.folderOptions.filter((option) => option.id !== folder.id).map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </Select>
                <Button type="submit" variant="outline" size="sm" disabled={unavailable}><FolderInput size={15} aria-hidden="true" />Move</Button>
              </div>
            </form>
            {data.permissions?.includes("courses.delete") && ["owner", "admin"].includes(data.workspaceRole) && <div className="border-t border-slate-100 pt-2">
              <Button variant="ghost" size="sm" disabled={unavailable} onClick={() => {
                if (window.confirm(`Delete the empty folder “${folder.name}”?`)) void onRequest(`/api/folders/${folder.id}`, "DELETE");
              }} className="w-full justify-start text-xs text-rose-700 hover:bg-rose-50"><Trash2 size={14} aria-hidden="true" />Delete empty folder</Button>
            </div>}
          </div>
        </Popover>}
      </div>
    </Card>
  );
}
