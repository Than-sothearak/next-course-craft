"use client";

import type { FormEvent } from "react";
import { X } from "lucide-react";
import type { DashboardData } from "@/lib/dashboard/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type Props = {
  openFolder: boolean;
  openCourse: boolean;
  data: DashboardData;
  busy: boolean;
  onCloseFolder: () => void;
  onCloseCourse: () => void;
  onSubmit: (
    event: FormEvent<HTMLFormElement>,
    url: string,
    method: string,
  ) => Promise<void>;
};

export function DashboardDialogs({
  openFolder,
  openCourse,
  data,
  busy,
  onCloseFolder,
  onCloseCourse,
  onSubmit,
}: Props) {
  return (
    <>
      {openFolder && (
        <div
          className="dialog-backdrop-in fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/35 p-4 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onCloseFolder();
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") onCloseFolder();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-folder-title"
            className="dialog-panel-in w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
          >
            <div className="mb-6 flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-indigo-700">
                  Workspace organization
                </p>
                <h2
                  id="new-folder-title"
                  className="mt-1 text-xl font-semibold tracking-tight"
                >
                  Create a folder
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Keep related courses together.
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onCloseFolder}
                aria-label="Close dialog"
              >
                <X size={18} />
              </Button>
            </div>
            <form
              onSubmit={(event) => onSubmit(event, "/api/folders", "POST")}
              className="space-y-4"
            >
              <label className="block text-sm font-medium text-slate-700">
                Folder name
                <Input
                  required
                  name="name"
                  maxLength={120}
                  autoFocus
                  placeholder="e.g. Product training"
                  className="mt-1.5 font-normal"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Create inside
                <Select
                  name="parentId"
                  defaultValue={data.currentFolder?.id ?? ""}
                  className="mt-1.5 font-normal"
                >
                  <option value="">All courses</option>
                  {data.folderOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </label>
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <Button variant="outline" onClick={onCloseFolder}>
                  Cancel
                </Button>
                <Button type="submit" disabled={busy}>
                  Create folder
                </Button>
              </div>
            </form>
          </section>
        </div>
      )}
      {openCourse && (
        <div
          className="dialog-backdrop-in fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/35 p-4 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onCloseCourse();
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") onCloseCourse();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-course-title"
            className="dialog-panel-in w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
          >
            <div className="mb-6 flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-indigo-700">
                  New learning experience
                </p>
                <h2
                  id="new-course-title"
                  className="mt-1 text-xl font-semibold tracking-tight"
                >
                  Create a course
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Start with a title. You can add content next.
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onCloseCourse}
                aria-label="Close dialog"
              >
                <X size={18} />
              </Button>
            </div>
            <form
              onSubmit={(event) => onSubmit(event, "/api/courses", "POST")}
              className="space-y-4"
            >
              <label className="block text-sm font-medium text-slate-700">
                Course title
                <Input
                  required
                  name="title"
                  maxLength={160}
                  autoFocus
                  placeholder="e.g. Welcome to the team"
                  className="mt-1.5 font-normal"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Save in
                <Select
                  name="folderId"
                  defaultValue={data.currentFolder?.id ?? ""}
                  className="mt-1.5 font-normal"
                >
                  <option value="">All courses</option>
                  {data.folderOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Cover image URL{" "}
                <span className="font-normal text-slate-400">(optional)</span>
                <Input
                  name="coverImage"
                  type="url"
                  placeholder="https://…"
                  className="mt-1.5 font-normal"
                />
              </label>
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <Button variant="outline" onClick={onCloseCourse}>
                  Cancel
                </Button>
                <Button type="submit" disabled={busy}>
                  Create course
                </Button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
