import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { dashboardErrorResponse, readJson, requireOwnerId } from "@/lib/dashboard/http";
import { objectIdSchema } from "@/lib/dashboard/schemas";
import { mediaUploadInputSchema } from "@/lib/media/schemas";
import { assertCourseOwner, listCourseMedia } from "@/lib/media/services/course-assets";
import { beginMediaUpload } from "@/lib/media/services/uploads";
import { DashboardError } from "@/lib/dashboard/rules";

export const runtime = "nodejs";
type Context = { params: Promise<{ courseId: string }> };

async function getCourseId(context: Context) {
  const { courseId } = await context.params;
  if (!objectIdSchema.safeParse(courseId).success) throw new DashboardError("Invalid course identifier.", 400);
  return courseId;
}

export async function GET(_request: NextRequest, context: Context) {
  try {
    const ownerId = await requireOwnerId();
    await connectToDatabase();
    const courseId = await getCourseId(context);
    await assertCourseOwner(ownerId, courseId);
    return NextResponse.json({ assets: await listCourseMedia(ownerId, courseId) });
  } catch (error) {
    return dashboardErrorResponse(error);
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const ownerId = await requireOwnerId();
    await connectToDatabase();
    const courseId = await getCourseId(context);
    await assertCourseOwner(ownerId, courseId);
    const input = await readJson(request, mediaUploadInputSchema);
    return NextResponse.json(await beginMediaUpload(ownerId, courseId, input), { status: 201 });
  } catch (error) {
    return dashboardErrorResponse(error);
  }
}
