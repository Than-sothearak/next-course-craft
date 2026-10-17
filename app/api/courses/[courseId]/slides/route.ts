import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { dashboardErrorResponse, readJson, requireOwnerId } from "@/lib/dashboard/http";
import { resolveCourseAccess } from "@/lib/workspaces/access";
import { createCourseSlide, getCourseSlides } from "@/lib/slides/service";
import { createSlideSchema } from "@/lib/slides/schema";

type Context = { params: Promise<{ courseId: string }> };

export async function GET(_request: NextRequest, { params }: Context) {
  try {
    const userId = await requireOwnerId();
    await connectToDatabase();
    const { courseId } = await params;
    const { ownerId } = await resolveCourseAccess(userId, courseId, "edit");
    return NextResponse.json(await getCourseSlides(ownerId, courseId), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return dashboardErrorResponse(error);
  }
}

export async function POST(request: NextRequest, { params }: Context) {
  try {
    const userId = await requireOwnerId();
    await connectToDatabase();
    const { courseId } = await params;
    const { ownerId } = await resolveCourseAccess(userId, courseId, "edit");
    const input = await readJson(request, createSlideSchema);
    return NextResponse.json(await createCourseSlide(ownerId, courseId, input.title, input.templateId), { status: 201 });
  } catch (error) {
    return dashboardErrorResponse(error);
  }
}
