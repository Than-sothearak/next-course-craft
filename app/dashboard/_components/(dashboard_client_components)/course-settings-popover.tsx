"use client";

import Image from "next/image";
import { useId, useState, type ComponentProps } from "react";
import { Copy, FolderInput, ImagePlus, MoreHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover } from "@/components/ui/popover";
import { Select } from "@/components/ui/select";
import { PublishMenu } from "@/components/publish-menu";
import { MediaLibraryDialog } from "@/app/courses/[courseId]/edit/_components/media-library-dialog";
import type { CourseCard } from "./course-card";

export function CourseSettingsPopover({ course, data, disabled, busy, error, onSubmit, onRequest }: ComponentProps<typeof CourseCard>) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [coverLibraryOpen, setCoverLibraryOpen] = useState(false);
  const [copyWorkspaceId, setCopyWorkspaceId] = useState(data.workspaceId ?? "");
  const unavailable = disabled || busy;
  const apiPath = `/api/courses/${course.id}`;
  const labelClass = "mb-1.5 block text-xs font-medium text-slate-600";

  return <>
    <Popover
      open={open}
      onOpenChange={setOpen}
      title="Course settings"
      triggerLabel={`Manage ${course.title}`}
      trigger={<MoreHorizontal size={18} aria-hidden="true" />}
      disabled={unavailable}
      busy={busy}
      footer={<>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => setOpen(false)} className="mr-auto">Done</Button>
        {course.permissions?.includes("courses.publish") && course.permissions?.includes("courses.export") && <PublishMenu courseId={course.id} title={course.title} disabled={unavailable} openUpward />}
      </>}
    >
      <div className="space-y-4">
        {error && <p role="alert" className="rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700">{error}</p>}
        <section aria-label="Course details" className="space-y-3">
          <form onSubmit={(event) => onSubmit(event, apiPath, "PATCH")}>
            <label htmlFor={`${id}-title`} className={labelClass}>Course title</label>
            <div className="flex gap-2">
              <Input id={`${id}-title`} name="title" required maxLength={160} defaultValue={course.title} disabled={unavailable} className="h-9 min-w-0" />
              <Button type="submit" size="sm" disabled={unavailable}>Save title</Button>
            </div>
          </form>
          <label className="block text-xs font-medium text-slate-600">
            Status
            <Select value={course.status} disabled={unavailable} onChange={(event) => void onRequest(apiPath, "PATCH", { status: event.target.value })} className="mt-1.5 h-9 font-normal">
              <option value="draft">Draft</option>
              <option value="published" disabled={!course.permissions?.includes("courses.publish")}>Published</option>
              <option value="archived">Archived</option>
            </Select>
          </label>
        </section>
        <section aria-label="Course image" className="space-y-2 border-t border-slate-100 pt-3">
          <h3 className={labelClass}>Course image</h3>
          {course.coverImage && <div className="relative h-20 overflow-hidden rounded-lg bg-slate-50"><Image src={course.coverImage} alt={`Cover for ${course.title}`} fill unoptimized sizes="288px" className="object-cover" /></div>}
          <Button size="sm" variant="outline" disabled={unavailable} onClick={() => { setOpen(false); setCoverLibraryOpen(true); }} className="w-full"><ImagePlus size={14} aria-hidden="true" />Choose or upload image</Button>
          {course.coverImage && <Button size="sm" variant="ghost" disabled={unavailable} onClick={() => void onRequest(apiPath, "PATCH", { coverImage: null })} className="w-full text-rose-700 hover:bg-rose-50"><Trash2 size={14} aria-hidden="true" />Remove image</Button>}
        </section>
        <section aria-label="Organization" className="space-y-3 border-t border-slate-100 pt-3">
          <form onSubmit={(event) => onSubmit(event, apiPath, "PATCH")}>
            <label htmlFor={`${id}-folder`} className={labelClass}>Move to folder</label>
            <div className="flex gap-2">
              <Select id={`${id}-folder`} name="folderId" defaultValue={course.folderId ?? ""} disabled={unavailable} className="h-9 min-w-0 flex-1">
                <option value="">All courses</option>
                {data.folderOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </Select>
              <Button type="submit" variant="outline" size="sm" disabled={unavailable} aria-label="Move course"><FolderInput size={15} aria-hidden="true" />Move</Button>
            </div>
          </form>
          <label className="block text-xs font-medium text-slate-600">
            Copy to workspace
            <Select value={copyWorkspaceId} disabled={unavailable} onChange={(event) => setCopyWorkspaceId(event.target.value)} className="mt-1.5 h-9 font-normal">
              <option value="">Personal</option>
              {data.workspaces.map((workspace) => <option key={workspace.id} value={workspace.id} disabled={workspace.role === "viewer"}>{workspace.name}{workspace.role === "viewer" ? " · view only" : ""}</option>)}
            </Select>
          </label>
          <Button size="sm" variant="outline" disabled={unavailable} onClick={() => void onRequest(apiPath, "POST", { workspaceId: copyWorkspaceId || null })} className="w-full"><Copy size={15} aria-hidden="true" />Duplicate course</Button>
        </section>
        {course.permissions?.includes("courses.delete") && <div className="border-t border-slate-100 pt-2">
          <Button size="sm" variant="ghost" disabled={unavailable} onClick={() => {
            const title = window.prompt(`To move this course to Recently deleted, type its title exactly:\n\n${course.title}`);
            if (title !== null) void onRequest(apiPath, "DELETE", { confirmTitle: title });
          }} className="w-full justify-start text-xs text-rose-700 hover:bg-rose-50"><Trash2 size={14} aria-hidden="true" />Move to recently deleted</Button>
        </div>}
      </div>
    </Popover>
    <MediaLibraryDialog courseId={course.id} kind="image" open={coverLibraryOpen} onClose={() => { setCoverLibraryOpen(false); setOpen(true); }} onSelect={(asset) => {
      setCoverLibraryOpen(false);
      setOpen(true);
      void onRequest(apiPath, "PATCH", { coverImage: asset.fileUrl });
    }} />
  </>;
}
