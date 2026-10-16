import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { dashboardErrorResponse, requireOwnerId } from "@/lib/dashboard/http";
import { objectIdSchema } from "@/lib/dashboard/schemas";
import { assertCourseOwner, deleteCourseMediaAsset } from "@/lib/media/services/course-assets";
import { DashboardError } from "@/lib/dashboard/rules";

type Context = { params: Promise<{ courseId: string; assetId: string }> };

export async function DELETE(_request: NextRequest, { params }: Context) {
  try {
    const ownerId = await requireOwnerId();
    await connectToDatabase();
    const { courseId, assetId } = await params;
    if (!objectIdSchema.safeParse(courseId).success) throw new DashboardError("Invalid course identifier.", 400);
    if (!objectIdSchema.safeParse(assetId).success) throw new DashboardError("Invalid asset identifier.", 400);
    await assertCourseOwner(ownerId, courseId);
    await deleteCourseMediaAsset(ownerId, courseId, assetId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return dashboardErrorResponse(error);
  }
}
