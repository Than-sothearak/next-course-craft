import type { CourseNavigationMode } from "@/lib/editor/navigation";
import type { EditorSnapshotInput } from "@/lib/editor/schemas";

export type PreviewData = {
  courseId: string;
  theme?: EditorSnapshotInput["theme"];
  navigationMode?: CourseNavigationMode;
  courseLayout?: EditorSnapshotInput["courseLayout"];
  slideMaster?: EditorSnapshotInput["slideMaster"];
} & Omit<EditorSnapshotInput, "revision" | "theme" | "navigationMode" | "courseLayout" | "slideMaster">;

export type PreviewMode = "course" | "learn";
export type PreviewDevice = "desktop" | "tablet" | "mobile";
export type PreviewOrientation = "portrait" | "landscape";
export type PreviewEditTarget = { lessonId: string; blockId?: string };
export type PreviewLesson = PreviewData["lessons"][number];
export type PreviewSection = PreviewData["sections"][number];
