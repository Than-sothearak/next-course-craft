import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { dashboardErrorResponse, readJson, requireOwnerId } from "@/lib/dashboard/http";
import { resolveCourseAccess } from "@/lib/workspaces/access";
import { assertMutationOrigin } from "@/lib/auth/http-security";
import { slideSnapshotSchema } from "@/lib/slides/schema";
import { deleteCourseSlide, saveCourseSlide } from "@/lib/slides/service";

type Context = { params: Promise<{ courseId: string; slideId: string }> };

export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    const userId = await requireOwnerId();
    await connectToDatabase();
    const { courseId, slideId } = await params;
    const { ownerId } = await resolveCourseAccess(userId, courseId, "edit");
    const input = await readJson(request, slideSnapshotSchema);
    return NextResponse.json(await saveCourseSlide(ownerId, courseId, slideId, input));
  } catch (error) {
    return dashboardErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  try {
    assertMutationOrigin(request);
    const userId = await requireOwnerId();
    await connectToDatabase();
    const { courseId, slideId } = await params;
    const { ownerId } = await resolveCourseAccess(userId, courseId, "edit");
    await deleteCourseSlide(ownerId, courseId, slideId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return dashboardErrorResponse(error);
  }
}
