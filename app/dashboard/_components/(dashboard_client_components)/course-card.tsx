"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { BookOpenText, Clock3, ImagePlus, MoreHorizontal, Presentation, Trash2 } from "lucide-react";
import type { DashboardCourse, DashboardData } from "@/lib/dashboard/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PublishMenu } from "@/components/publish-menu";
import { MediaLibraryDialog, type MediaLibraryAsset } from "@/app/courses/[courseId]/edit/_components/media-library-dialog";

function dateLabel(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function CourseCard({
  course,
  data,
  disabled,
  busy,
  onSubmit,
  onRequest,
}: {
  course: DashboardCourse;
  data: DashboardData;
  disabled: boolean;
  busy: boolean;
  onSubmit: (
    event: FormEvent<HTMLFormElement>,
    url: string,
    method: string,
  ) => Promise<void>;
  onRequest: (url: string, method: string, body?: unknown) => Promise<void>;
}) {
  const statusVariant =
    course.status === "published"
      ? "success"
      : course.status === "archived"
        ? "secondary"
        : "default";
  const menuRef = useRef<HTMLDetailsElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [coverLibraryOpen, setCoverLibraryOpen] = useState(false);
  const [copyWorkspaceId, setCopyWorkspaceId] = useState(data.workspaceId ?? "");
  const readOnly = !course.permissions?.includes("courses.edit");
  const courseHref = readOnly ? `/courses/${course.id}/preview` : `/courses/${course.id}/edit`;

  useEffect(() => {
    function closeWhenClickingOutside(event: PointerEvent) {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) {
        menuRef.current?.removeAttribute("open");
        setMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeWhenClickingOutside);
    return () => document.removeEventListener("pointerdown", closeWhenClickingOutside);
  }, []);

  return (
    <>
    <Card className={`relative rounded-2xl overflow-visible shadow-[0_2px_8px_rgba(15,23,42,0.03)] transition hover:border-indigo-200 hover:shadow-md ${menuOpen ? "z-30" : "z-0"}`}>
      <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-t-2xl bg-gradient-to-br from-indigo-100 via-violet-50 to-cyan-50">
        {course.coverImage ? (
          <Image
            src={course.coverImage}
            alt={`Cover for ${course.title}`}
            width={640}
            height={224}
            unoptimized
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          course.courseLayout === "slides" ? <Presentation
            size={34}
            className="text-indigo-400/80"
            aria-hidden="true"
          /> : <BookOpenText
            size={34}
            className="text-indigo-400/80"
            aria-hidden="true"
          />
        )}
        <span className="absolute right-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm backdrop-blur">
          {course.courseLayout === "slides" ? <Presentation size={13} aria-hidden="true" /> : <BookOpenText size={13} aria-hidden="true" />}
          {course.courseLayout === "slides" ? "Slide presentation" : "Standard course"}
        </span>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3
              className="truncate font-semibold text-slate-900"
              title={course.title}
            >
              <Link href={courseHref} className="rounded-sm hover:text-indigo-700 focus-visible:outline-2 focus-visible:outline-indigo-600">{course.title}</Link>
            </h3>
            <p className="mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-slate-500">
              {course.description || "Start building your learning experience."}
            </p>
          </div>
          {!readOnly && <details ref={menuRef} onToggle={(event) => setMenuOpen(event.currentTarget.open)} className="relative shrink-0">
            <summary
              aria-label={`Manage ${course.title}`}
              onClick={() => setMenuOpen((open) => !open)}
              className="grid size-8 cursor-pointer list-none place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 [&::-webkit-details-marker]:hidden"
            >
              <MoreHorizontal size={18} />
            </summary>
            <div className="absolute right-0 top-full z-50 mt-1 flex max-h-[min(72vh,560px)] w-60 flex-col gap-3 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
              <form
                onSubmit={(event) =>
                  onSubmit(event, `/api/courses/${course.id}`, "PATCH")
                }
                className="space-y-2 flex flex-col"
              >
                <label className="text-xs font-semibold text-slate-500">
                  Rename course
                  <Input
                    name="title"
                    required
                    maxLength={160}
                    defaultValue={course.title}
                    className="mt-1 h-9 px-2 text-sm font-normal"
                  />
                </label>
                <Button
                  type="submit"
                  size="sm"
                  className="w-full bg-slate-900 text-xs hover:bg-slate-800"
                >
                  Save title
                </Button>
              </form>
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-500">
                  Course image
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={disabled || busy}
                  onClick={() => setCoverLibraryOpen(true)}
                  className="w-full text-xs"
                >
                  <ImagePlus size={14} />Choose or upload image
                </Button>
                {course.coverImage && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={disabled || busy}
                    onClick={() => void onRequest(`/api/courses/${course.id}`, "PATCH", { coverImage: null })}
                    className="w-full justify-start text-xs text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                  >
                    <Trash2 size={14} />Remove course image
                  </Button>
                )}
              </div>
              <form
                onSubmit={(event) =>
                  onSubmit(event, `/api/courses/${course.id}`, "PATCH")
                }
                className="flex flex-col gap-2"
              >
                <label className="text-xs font-semibold text-slate-500">
                  Move course
                  <Select
                    name="folderId"
                    defaultValue={course.folderId ?? ""}
                    className="mt-1 h-9 px-2 text-sm font-normal text-slate-900"
                  >
                    <option value="">All courses</option>
                    {data.folderOptions.map((option) => (
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
              <label className="block text-xs font-semibold text-slate-500">
                Status
                <Select
                  value={course.status}
                  onChange={(event) =>
                    void onRequest(`/api/courses/${course.id}`, "PATCH", {
                      status: event.target.value,
                    })
                  }
                  disabled={disabled}
                  className="mt-1 h-9 px-2 text-sm font-normal text-slate-900"
                >
                  <option value="draft">Draft</option>
                  <option value="published" disabled={!course.permissions?.includes("courses.publish")}>Published</option>
                  <option value="archived">Archived</option>
                </Select>
              </label>
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-500">
                  Copy to workspace
                  <Select value={copyWorkspaceId} onChange={(event) => setCopyWorkspaceId(event.target.value)} className="mt-1 h-9 w-full px-2 text-sm font-normal text-slate-900">
                    <option value="">Personal</option>
                    {data.workspaces.map((workspace) => <option key={workspace.id} value={workspace.id} disabled={workspace.role === "viewer"}>{workspace.name}{workspace.role === "viewer" ? " · view only" : ""}</option>)}
                  </Select>
                </label>
                <Button
                  variant="outline"
                  disabled={disabled || busy}
                  onClick={() => void onRequest(`/api/courses/${course.id}`, "POST", { workspaceId: copyWorkspaceId || null })}
                  className="h-auto min-h-0 w-full justify-start rounded-md px-2 py-2 text-left text-xs"
                >
                  Duplicate course
                </Button>
              </div>
              {course.permissions?.includes("courses.publish") && course.permissions?.includes("courses.export") && <PublishMenu
                courseId={course.id}
                title={course.title}
                disabled={disabled || busy}
                className="h-9 w-full justify-start px-2 text-xs"
                openUpward
                onPublished={() => {
                  menuRef.current?.removeAttribute("open");
                  setMenuOpen(false);
                }}
              />}
              {course.permissions?.includes("courses.delete") && <Button
                variant="ghost"
                disabled={disabled || busy}
                onClick={() => {
                  const title = window.prompt(
                    `To move this course to Recently deleted, type its title exactly:\n\n${course.title}`,
                  );
                  if (title !== null)
                    void onRequest(`/api/courses/${course.id}`, "DELETE", {
                      confirmTitle: title,
                    });
                }}
                className="h-auto min-h-0 w-full justify-start rounded-md px-2 py-2 text-left text-xs font-semibold text-rose-700 hover:bg-rose-50"
              >
                Move to recently deleted
              </Button>}
            </div>
          </details>}
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
          <Badge variant={statusVariant}>{course.status}</Badge>
          <span className="inline-flex items-center gap-1 text-xs text-slate-400">
            <Clock3 size={13} aria-hidden="true" />
            {dateLabel(course.updatedAt)}
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span>
            {course.lessonCount}{" "}
            {course.lessonCount === 1 ? "lesson" : "lessons"}
          </span>
          {course.permissions?.includes("courses.assign") && <Link href={`/courses/${course.id}/access`} className="font-medium text-indigo-700">Share access</Link>}
          <Link href={courseHref} className="font-medium text-indigo-700 hover:text-indigo-900">{readOnly ? "Preview course" : "Open editor"} <span aria-hidden="true">→</span></Link>
        </div>
      </div>
    </Card>
    <MediaLibraryDialog
      courseId={course.id}
      kind="image"
      open={coverLibraryOpen}
      onClose={() => setCoverLibraryOpen(false)}
      onSelect={(asset: MediaLibraryAsset) => {
        void onRequest(`/api/courses/${course.id}`, "PATCH", { coverImage: asset.fileUrl });
        menuRef.current?.removeAttribute("open");
        setMenuOpen(false);
      }}
    />
    </>
  );
}
