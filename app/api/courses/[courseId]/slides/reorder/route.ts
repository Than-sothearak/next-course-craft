import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { dashboardErrorResponse, readJson, requireOwnerId } from "@/lib/dashboard/http";
import { resolveCourseAccess } from "@/lib/workspaces/access";
import { reorderSlidesSchema } from "@/lib/slides/schema";
import { reorderCourseSlides } from "@/lib/slides/service";

type Context = { params: Promise<{ courseId: string }> };

export async function PUT(request: NextRequest, { params }: Context) {
  try {
    const userId = await requireOwnerId();
    await connectToDatabase();
    const { courseId } = await params;
    const { ownerId } = await resolveCourseAccess(userId, courseId, "edit");
    const input = await readJson(request, reorderSlidesSchema);
    return NextResponse.json(await reorderCourseSlides(ownerId, courseId, input.slideIds));
  } catch (error) {
    return dashboardErrorResponse(error);
  }
}
