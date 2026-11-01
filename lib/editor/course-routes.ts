import type { CourseLayout } from "./course-layout";

export type CourseEditorMode = "standard" | "presentation";
export type CourseRouteMode = CourseEditorMode | "auto";

export function courseEditorMode(layout?: CourseLayout): CourseEditorMode {
  return layout === "slides" ? "presentation" : "standard";
}

function modeSegment(mode: CourseEditorMode) {
  return mode === "presentation" ? "presentation-mode" : "standard-mode";
}

export function editorModeHref(courseId: string, mode: CourseEditorMode) {
  return `/courses/${encodeURIComponent(courseId)}/edit/${modeSegment(mode)}`;
}

export function previewModeHref(courseId: string, mode: CourseEditorMode) {
  return `/courses/${encodeURIComponent(courseId)}/preview/${modeSegment(mode)}`;
}

export function lessonEditorHref(
  courseId: string,
  lessonId?: string,
  blockId?: string,
  mode: CourseEditorMode = "standard",
) {
  const coursePath = editorModeHref(courseId, mode);
  if (!lessonId) return coursePath;

  if (mode === "presentation") {
    const query = new URLSearchParams({ lessonId });
    if (blockId) query.set("blockId", blockId);
    return `${coursePath}?${query.toString()}`;
  }

  const lessonPath = `${coursePath}/lessons/${encodeURIComponent(lessonId)}`;
  return blockId
    ? `${lessonPath}?blockId=${encodeURIComponent(blockId)}`
    : lessonPath;
}
