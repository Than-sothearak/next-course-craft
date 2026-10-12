import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { dashboardErrorResponse, requireOwnerId } from "@/lib/dashboard/http";
import { addCourseLesson } from "@/lib/editor/service";

export const runtime = "nodejs";
type Context = { params: Promise<{ courseId: string }> };

export async function POST(_request: NextRequest, { params }: Context) {
  try {
    const ownerId = await requireOwnerId();
    await connectToDatabase();
    const { courseId } = await params;
    return NextResponse.json(await addCourseLesson(ownerId, courseId), { status: 201 });
  } catch (error) {
    return dashboardErrorResponse(error);
  }
}
