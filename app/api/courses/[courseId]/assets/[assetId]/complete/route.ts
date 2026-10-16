import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { dashboardErrorResponse, requireOwnerId } from "@/lib/dashboard/http";
import { objectIdSchema } from "@/lib/dashboard/schemas";
import { assertCourseOwner } from "@/lib/media/services/course-assets";
import { completeMediaUpload } from "@/lib/media/services/uploads";
import { DashboardError } from "@/lib/dashboard/rules";

type Context = { params: Promise<{ courseId: string; assetId: string }> };

export async function POST(_request: NextRequest, { params }: Context) {
  try {
    const ownerId = await requireOwnerId();
    await connectToDatabase();
    const { courseId, assetId } = await params;
    if (!objectIdSchema.safeParse(courseId).success) throw new DashboardError("Invalid course identifier.", 400);
    if (!objectIdSchema.safeParse(assetId).success) throw new DashboardError("Invalid asset identifier.", 400);
    await assertCourseOwner(ownerId, courseId);
    return NextResponse.json(await completeMediaUpload(ownerId, courseId, assetId));
  } catch (error) {
    return dashboardErrorResponse(error);
  }
}
