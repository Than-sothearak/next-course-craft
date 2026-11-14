import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/db/mongodb";
import { dashboardErrorResponse, readJson, requireOwnerId } from "@/lib/dashboard/http";
import { getCourseEditor } from "@/lib/editor/services/course";
import { saveCourseEditor } from "@/lib/editor/services/save";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { resolveCourseAccess } from "@/lib/workspaces/access";

type Context = { params: Promise<{ courseId: string }> };

export async function GET(_request: NextRequest, { params }: Context) {
  try {
    const userId = await requireOwnerId();
    await connectToDatabase();
    const { courseId } = await params;
    const { ownerId } = await resolveCourseAccess(userId, courseId, "edit");
    return NextResponse.json(await getCourseEditor(ownerId, courseId));
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
    const snapshot = await readJson(request, editorSnapshotSchema);
    const saved = await saveCourseEditor(ownerId, courseId, snapshot);
    revalidatePath("/dashboard", "page");
    return NextResponse.json(saved);
  } catch (error) {
    return dashboardErrorResponse(error);
  }
}
