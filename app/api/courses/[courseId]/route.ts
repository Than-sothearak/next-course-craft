import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { duplicateCourse, getCourseCopyDestinations, softDeleteCourse, updateCourse } from "@/lib/dashboard/services/courses";
import { deleteCourseSchema, objectIdSchema, updateCourseSchema } from "@/lib/dashboard/schemas";
import { dashboardErrorResponse, readJson, requireOwnerId } from "@/lib/dashboard/http";
import { DashboardError } from "@/lib/dashboard/rules";

type RouteContext = { params: Promise<{ courseId: string }> };

async function validatedCourseId(context: RouteContext) {
  const { courseId } = await context.params;
  if (!objectIdSchema.safeParse(courseId).success) throw new DashboardError("Invalid course identifier.", 400);
  return courseId;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const ownerId = await requireOwnerId();
    await connectToDatabase();
    const courseId = await validatedCourseId(context);
    const input = await readJson(request, updateCourseSchema);
    return NextResponse.json(await updateCourse(ownerId, courseId, input));
  } catch (error) {
    return dashboardErrorResponse(error);
  }
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const ownerId = await requireOwnerId();
    await connectToDatabase();
    const courseId = await validatedCourseId(context);
    return NextResponse.json(await getCourseCopyDestinations(ownerId, courseId));
  } catch (error) {
    return dashboardErrorResponse(error);
  }
}

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const ownerId = await requireOwnerId();
    await connectToDatabase();
    const courseId = await validatedCourseId(context);
    return NextResponse.json(await duplicateCourse(ownerId, courseId), { status: 201 });
  } catch (error) {
    return dashboardErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const ownerId = await requireOwnerId();
    await connectToDatabase();
    const courseId = await validatedCourseId(context);
    const input = await readJson(request, deleteCourseSchema);
    await softDeleteCourse(ownerId, courseId, input.confirmTitle);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return dashboardErrorResponse(error);
  }
}
