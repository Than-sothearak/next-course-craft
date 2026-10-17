export const courseEditorTypes = ["block", "slide"] as const;

export type CourseEditorType = (typeof courseEditorTypes)[number];

export function normalizeCourseEditorType(value: unknown): CourseEditorType {
  return value === "slide" ? "slide" : "block";
}

export function courseEditorPath(courseId: string, editorType: unknown): string {
  return editorType === "slide"
    ? `/courses/${courseId}/slides/edit`
    : `/courses/${courseId}/edit`;
}
