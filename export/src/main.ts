import { createElement } from "react";
import { createRoot } from "react-dom/client";
import "../../app/globals.css";
import { createScorm2004ProgressAdapter, createScormProgressAdapter } from "./scorm-runtime";
import {
  CoursePreview,
  type PreviewData,
} from "../../app/courses/[courseId]/preview/course-preview";

declare global {
  interface Window {
    COURSE_EXPORT_DATA?: PreviewData & {
      authorName?: string;
      scorm12Enabled?: boolean;
      scorm2004Enabled?: boolean;
    };
    COURSE_EXPORT_MEDIA?: Record<string, string>;
  }
}

const exportRoot = document.querySelector<HTMLDivElement>("#export-root");
if (!exportRoot) throw new Error("Course export root element is missing.");

const courseData = window.COURSE_EXPORT_DATA;
if (!courseData) {
  exportRoot.innerHTML =
    "<main role='alert' class='min-h-screen p-6 text-slate-900'>Course data is missing.</main>";
  throw new Error("Course export data is missing.");
}

void (async () => {
  const mediaSources = new Map<string, string>();
  for (const [id, dataUri] of Object.entries(window.COURSE_EXPORT_MEDIA ?? {})) {
    const blob = await fetch(dataUri).then((response) => response.blob());
    mediaSources.set(id, URL.createObjectURL(blob));
  }
  function resolveMedia(value: unknown): unknown {
    if (typeof value === "string") return value.replace(/coursecraft-media:([\da-f]{24})/gi, (match, id: string) => mediaSources.get(id.toLowerCase()) ?? match);
    if (Array.isArray(value)) return value.map(resolveMedia);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveMedia(item)]));
    return value;
  }
  const resolvedData = resolveMedia(courseData) as typeof courseData;
  createRoot(exportRoot).render(createElement(CoursePreview, {
    initialData: resolvedData,
    authorName: resolvedData.authorName ?? "",
    standalone: true,
    progressAdapter: resolvedData.scorm2004Enabled
      ? createScorm2004ProgressAdapter(resolvedData) ?? undefined
      : resolvedData.scorm12Enabled
        ? createScormProgressAdapter(resolvedData) ?? undefined
        : undefined,
  }));
})().catch((error: unknown) => {
  exportRoot.innerHTML = "<main role='alert' class='min-h-screen p-6 text-slate-900'>Course media could not be loaded.</main>";
  console.error(error);
});
