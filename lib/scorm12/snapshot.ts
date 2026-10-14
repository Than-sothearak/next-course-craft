import { DashboardError } from "@/lib/dashboard/rules";
import { editorSnapshotSchema } from "@/lib/editor/schemas";

export function parseScorm12Snapshot(value: unknown) {
  const result = editorSnapshotSchema.safeParse(value);
  if (!result.success) {
    throw new DashboardError("The course content is invalid and cannot be exported.", 422);
  }
  if (!result.data.lessons.length) {
    throw new DashboardError("Add at least one lesson before creating a SCORM package.", 422);
  }
  return result.data;
}
