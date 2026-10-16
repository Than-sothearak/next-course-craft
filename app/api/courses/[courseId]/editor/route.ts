import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { dashboardErrorResponse, readJson, requireOwnerId } from "@/lib/dashboard/http";
import { getCourseEditor } from "@/lib/editor/services/course";
import { saveCourseEditor } from "@/lib/editor/services/save";
import { editorSnapshotSchema } from "@/lib/editor/schemas";

type Context = { params: Promise<{ courseId: string }> };

export async function GET(_request: NextRequest, { params }: Context) {
  try {
    const ownerId = await requireOwnerId();
    await connectToDatabase();
    const { courseId } = await params;
    return NextResponse.json(await getCourseEditor(ownerId, courseId));
  } catch (error) {
    return dashboardErrorResponse(error);
  }
}

export async function PUT(request: NextRequest, { params }: Context) {
  try {
    const ownerId = await requireOwnerId();
    await connectToDatabase();
    const { courseId } = await params;
    const snapshot = await readJson(request, editorSnapshotSchema);
    return NextResponse.json(await saveCourseEditor(ownerId, courseId, snapshot));
  } catch (error) {
    return dashboardErrorResponse(error);
  }
}
