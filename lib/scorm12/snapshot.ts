import { DashboardError } from "@/lib/dashboard/rules";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { validateQuizAssessments } from "@/lib/interactive/quiz-assessment";

export function parseScorm12Snapshot(value: unknown) {
  const result = editorSnapshotSchema.safeParse(value);
  if (!result.success) {
    throw new DashboardError("The course content is invalid and cannot be exported.", 422);
  }
  if (!result.data.lessons.length) {
    throw new DashboardError("Add at least one lesson before exporting this course.", 422);
  }
  const assessmentIssue = validateQuizAssessments(result.data.lessons);
  if (assessmentIssue) throw new DashboardError(assessmentIssue, 422);
  return result.data;
}
