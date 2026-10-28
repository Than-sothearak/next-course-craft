"use client";

import type { FormEvent } from "react";
import { BookOpenText, Presentation, X } from "lucide-react";
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
            className="dialog-panel-in max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
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
                  Choose a layout, then add content with the lesson editor.
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
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-slate-700">Course template</legend>
                <div className="grid grid-cols-2 gap-3">
                  <label className="group flex min-h-44 cursor-pointer flex-col rounded-2xl border border-slate-200 bg-white p-3.5 transition-colors hover:border-indigo-300 hover:bg-indigo-50/40 focus-within:ring-2 focus-within:ring-indigo-500 has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50 has-[:checked]:shadow-sm sm:p-4">
                    <span className="flex items-start justify-between gap-2">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600 group-has-[:checked]:bg-indigo-600 group-has-[:checked]:text-white">
                        <BookOpenText size={21} aria-hidden="true" />
                      </span>
                      <input type="radio" name="courseLayout" value="standard" defaultChecked className="size-4 shrink-0 accent-indigo-600" />
                    </span>
                    <span className="mt-4 block text-sm font-semibold leading-tight text-slate-900">Standard course</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">Scrollable lessons with interactive blocks.</span>
                  </label>
                  <label className="group flex min-h-44 cursor-pointer flex-col rounded-2xl border border-slate-200 bg-white p-3.5 transition-colors hover:border-indigo-300 hover:bg-indigo-50/40 focus-within:ring-2 focus-within:ring-indigo-500 has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50 has-[:checked]:shadow-sm sm:p-4">
                    <span className="flex items-start justify-between gap-2">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600 group-has-[:checked]:bg-indigo-600 group-has-[:checked]:text-white">
                        <Presentation size={21} aria-hidden="true" />
                      </span>
                      <input type="radio" name="courseLayout" value="slides" className="size-4 shrink-0 accent-indigo-600" />
                    </span>
                    <span className="mt-4 block text-sm font-semibold leading-tight text-slate-900">Slide interactive presentation</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">16:9 slides with interactive blocks and navigation.</span>
                  </label>
                </div>
              </fieldset>
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
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
                After creating the course, choose or upload its image from the course card menu.
              </p>
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
