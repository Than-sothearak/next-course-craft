"use client";
import { useEffect, useRef, type FormEvent } from "react";
import { Folder, MoreHorizontal } from "lucide-react";
import type { DashboardData, DashboardFolder } from "@/lib/dashboard/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DashboardLink } from "../dashboard-link";

export function FolderCard({
  folder,
  data,
  disabled,
  busy,
  href,
  onSubmit,
  onRequest,
}: {
  folder: DashboardFolder;
  data: DashboardData;
  disabled: boolean;
  busy: boolean;
  href: string;
  onSubmit: (
    event: FormEvent<HTMLFormElement>,
    url: string,
    method: string,
  ) => Promise<void>;
  onRequest: (url: string, method: string, body?: unknown) => Promise<void>;
}) {
  const menuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function closeWhenClickingOutside(event: PointerEvent) {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) {
        menuRef.current?.removeAttribute("open");
      }
    }

    document.addEventListener("pointerdown", closeWhenClickingOutside);
    return () => document.removeEventListener("pointerdown", closeWhenClickingOutside);
  }, []);

  return (
    <Card className="group rounded-2xl p-4 shadow-[0_2px_8px_rgba(15,23,42,0.03)] transition hover:border-indigo-200 hover:shadow-md ">
      <div className="flex items-start justify-between gap-3">
        <DashboardLink
          href={href}
          className="cursor-pointer flex min-w-0 flex-1 items-start gap-3 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          <span className="">
            <Folder size={20} aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold text-slate-800 text-sm">
              {folder.name}
            </span>
            <span className="mt-1 block text-xs text-slate-500">
              {folder.courseCount} courses
              {/* {folder.subfolderCount} subfolders */}
            </span>
          </span>
        </DashboardLink>
        {data.permissions?.includes("courses.edit") && data.workspaceRole !== "viewer" && <details ref={menuRef} className="relative">
          <summary
            aria-label={`Manage ${folder.name}`}
            className="grid size-8 cursor-pointer list-none place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 [&::-webkit-details-marker]:hidden"
          >
            <MoreHorizontal size={18} />
          </summary>
          <div className="absolute right-0 z-10 mt-1 flex w-60 flex-col rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
            <form
              onSubmit={(event) =>
                onSubmit(event, `/api/folders/${folder.id}`, "PATCH")
              }
              className="flex flex-col space-y-2"
            >
              <label className="text-xs font-semibold text-slate-500">
                Rename folder
                <Input
                  name="name"
                  required
                  maxLength={120}
                  defaultValue={folder.name}
                  className="mt-1 h-9 px-2 text-sm font-normal"
                />
              </label>
              <Button
                type="submit"
                size="sm"
                className="w-full bg-slate-900 text-xs hover:bg-slate-800"
              >
                Save name
              </Button>
            </form>
            <form
              onSubmit={(event) =>
                onSubmit(event, `/api/folders/${folder.id}`, "PATCH")
              }
              className="mt-3 flex flex-col space-y-2"
            >
              <label className="text-xs font-semibold text-slate-500">
                Move folder
                <Select
                  name="parentId"
                  defaultValue={folder.parentId ?? ""}
                  className="mt-1 h-9 px-2 text-sm font-normal text-slate-900"
                >
                  <option value="">All courses</option>
                  {data.folderOptions
                    .filter((option) => option.id !== folder.id)
                    .map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                </Select>
              </label>
              <Button
                type="submit"
                variant="outline"
                size="sm"
                className="w-full text-xs"
              >
                Move
              </Button>
            </form>
            {data.permissions?.includes("courses.delete") && ["owner", "admin"].includes(data.workspaceRole) && <Button
              variant="ghost"
              disabled={disabled || busy}
              onClick={() => {
                if (
                  window.confirm(`Delete the empty folder â€œ${folder.name}â€?`)
                )
                  void onRequest(`/api/folders/${folder.id}`, "DELETE");
              }}
              className="mt-3 h-auto min-h-0 w-full justify-start rounded-md px-2 py-2 text-left text-xs font-semibold text-rose-700 hover:bg-rose-50"
            >
              Delete empty folder
            </Button>}
          </div>
        </details>}
      </div>
    </Card>
  );
}
