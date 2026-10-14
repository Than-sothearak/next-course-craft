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

createRoot(exportRoot).render(
  createElement(CoursePreview, {
    initialData: courseData,
    authorName: courseData.authorName ?? "",
    standalone: true,
    progressAdapter: courseData.scorm2004Enabled
      ? createScorm2004ProgressAdapter(courseData) ?? undefined
      : courseData.scorm12Enabled
        ? createScormProgressAdapter(courseData) ?? undefined
        : undefined,
  }),
);
