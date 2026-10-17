import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { dashboardErrorResponse, readJson, requireOwnerId } from "@/lib/dashboard/http";
import { getCourseEditor } from "@/lib/editor/services/course";
import { saveCourseEditor } from "@/lib/editor/services/save";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { resolveCourseAccess } from "@/lib/workspaces/access";
import { DashboardError } from "@/lib/dashboard/rules";

type Context = { params: Promise<{ courseId: string }> };

export async function GET(_request: NextRequest, { params }: Context) {
  try {
    const userId = await requireOwnerId();
    await connectToDatabase();
    const { courseId } = await params;
    const { ownerId } = await resolveCourseAccess(userId, courseId, "edit");
    const editor = await getCourseEditor(ownerId, courseId);
    if (editor.editorType !== "block")
      throw new DashboardError("Slide courses use the slide editor.", 409);
    return NextResponse.json(editor);
  } catch (error) {
    return dashboardErrorResponse(error);
  }
}

export async function PUT(request: NextRequest, { params }: Context) {
  try {
    const userId = await requireOwnerId();
    await connectToDatabase();
    const { courseId } = await params;
    const { ownerId } = await resolveCourseAccess(userId, courseId, "edit");
    const editor = await getCourseEditor(ownerId, courseId);
    if (editor.editorType !== "block")
      throw new DashboardError("Slide courses use the slide editor.", 409);
    const snapshot = await readJson(request, editorSnapshotSchema);
    return NextResponse.json(await saveCourseEditor(ownerId, courseId, snapshot));
  } catch (error) {
    return dashboardErrorResponse(error);
  }
}
