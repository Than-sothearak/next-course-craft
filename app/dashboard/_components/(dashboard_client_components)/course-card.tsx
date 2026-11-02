"use client";
import Image from "next/image";
import Link from "next/link";
import type { FormEvent } from "react";
import { BookOpenText, Clock3, Presentation } from "lucide-react";
import type { DashboardCourse, DashboardData } from "@/lib/dashboard/types";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CourseSettingsPopover } from "./course-settings-popover";
import { courseEditorMode, editorModeHref, previewModeHref } from "@/lib/editor/course-routes";

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
  error,
  onSubmit,
  onRequest,
}: {
  course: DashboardCourse;
  data: DashboardData;
  disabled: boolean;
  busy: boolean;
  error?: string | null;
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
  const readOnly = !course.permissions?.includes("courses.edit");
  const courseMode = courseEditorMode(course.courseLayout);
  const courseHref = readOnly
    ? previewModeHref(course.id, courseMode)
    : editorModeHref(course.id, courseMode);

  return (
    <>
    <Card className="relative flex h-full min-w-0 flex-col overflow-hidden rounded-2xl shadow-[0_2px_8px_rgba(15,23,42,0.03)] transition hover:border-indigo-200 hover:shadow-md">
      <div className="relative flex aspect-video w-full shrink-0 items-center justify-center overflow-hidden rounded-t-2xl bg-gradient-to-br from-indigo-100 via-violet-50 to-cyan-50">
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
      <div className="flex min-w-0 flex-1 flex-col p-4">
        <div className="flex flex-1 items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3
              className="line-clamp-2 break-words font-semibold text-slate-900"
              title={course.title}
            >
              <Link href={courseHref} className="rounded-sm hover:text-indigo-700 focus-visible:outline-2 focus-visible:outline-indigo-600">{course.title}</Link>
            </h3>
            <p className="mt-1 line-clamp-2 min-h-10 break-words text-sm leading-5 text-slate-500">
              {course.description || "Start building your learning experience."}
            </p>
          </div>
          {!readOnly && <CourseSettingsPopover course={course} data={data} disabled={disabled} busy={busy} error={error} onSubmit={onSubmit} onRequest={onRequest} />}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <Badge variant={statusVariant}>{course.status}</Badge>
          <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-slate-400">
            <Clock3 size={13} aria-hidden="true" />
            {dateLabel(course.updatedAt)}
          </span>
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-3 text-xs text-slate-500">
          <span className="mr-auto whitespace-nowrap">
            {course.lessonCount}{" "}
            {course.lessonCount === 1 ? "lesson" : "lessons"}
          </span>
          {course.permissions?.includes("courses.assign") && <Link href={`/courses/${course.id}/access`} className="inline-flex min-h-10 items-center whitespace-nowrap font-medium text-indigo-700 sm:min-h-8">Share access</Link>}
          <Link href={courseHref} className="inline-flex min-h-10 items-center whitespace-nowrap font-medium text-indigo-700 hover:text-indigo-900 sm:min-h-8">{readOnly ? "Preview course" : "Open editor"} <span aria-hidden="true">→</span></Link>
        </div>
      </div>
    </Card>

    </>
  );
}
