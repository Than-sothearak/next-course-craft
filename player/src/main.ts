import { createElement } from "react";
import { createRoot } from "react-dom/client";
import "../../app/globals.css";
import { createScormProgressAdapter } from "./scorm-runtime";
import {
  CoursePreview,
  type PreviewData,
} from "../../app/courses/[courseId]/preview/course-preview";

declare global {
  interface Window {
    COURSE_PLAYER_DATA?: PreviewData & {
      authorName?: string;
      scorm12Enabled?: boolean;
    };
  }
}

const playerRoot = document.querySelector<HTMLDivElement>("#player-root");
if (!playerRoot) throw new Error("Course player root element is missing.");

const courseData = window.COURSE_PLAYER_DATA;
if (!courseData) {
  playerRoot.innerHTML =
    "<main role='alert' class='min-h-screen p-6 text-slate-900'>Course data is missing.</main>";
  throw new Error("Course player data is missing.");
}

createRoot(playerRoot).render(
  createElement(CoursePreview, {
    initialData: courseData,
    authorName: courseData.authorName ?? "",
    standalone: true,
    progressAdapter: courseData.scorm12Enabled
      ? createScormProgressAdapter(courseData) ?? undefined
      : undefined,
  }),
);
