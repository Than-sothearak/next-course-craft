import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { dashboardErrorResponse, requireOwnerId } from "@/lib/dashboard/http";
import { resolveCourseAccess } from "@/lib/workspaces/access";
import { duplicateCourseSlide } from "@/lib/slides/service";
import { assertMutationOrigin } from "@/lib/auth/http-security";

type Context = { params: Promise<{ courseId: string; slideId: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  try {
    assertMutationOrigin(request);
    const userId = await requireOwnerId();
    await connectToDatabase();
    const { courseId, slideId } = await params;
    const { ownerId } = await resolveCourseAccess(userId, courseId, "edit");
    return NextResponse.json(await duplicateCourseSlide(ownerId, courseId, slideId), { status: 201 });
  } catch (error) {
    return dashboardErrorResponse(error);
  }
}
