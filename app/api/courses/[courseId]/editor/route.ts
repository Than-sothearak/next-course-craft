import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { dashboardErrorResponse, readJson, requireOwnerId } from "@/lib/dashboard/http";
import { getCourseEditor, saveCourseEditor } from "@/lib/editor/service";
import { editorSnapshotSchema } from "@/lib/editor/schemas";

export const runtime = "nodejs";

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
