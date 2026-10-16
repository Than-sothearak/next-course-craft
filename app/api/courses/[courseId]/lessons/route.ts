import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { dashboardErrorResponse, requireOwnerId } from "@/lib/dashboard/http";
import { addCourseLesson } from "@/lib/editor/services/lessons";
import { resolveCourseAccess } from "@/lib/workspaces/access";

type Context = { params: Promise<{ courseId: string }> };

export async function POST(_request: NextRequest, { params }: Context) {
  try {
    const userId = await requireOwnerId();
    await connectToDatabase();
    const { courseId } = await params;
    const { ownerId } = await resolveCourseAccess(userId, courseId, "edit");
    return NextResponse.json(await addCourseLesson(ownerId, courseId), { status: 201 });
  } catch (error) {
    return dashboardErrorResponse(error);
  }
}
