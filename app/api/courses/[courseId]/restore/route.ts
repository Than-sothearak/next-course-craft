import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { dashboardErrorResponse, requireOwnerId } from "@/lib/dashboard/http";
import { mutateCourse } from "@/lib/admin/courses";
import { objectIdSchema } from "@/lib/dashboard/schemas";
import { DashboardError } from "@/lib/dashboard/rules";

type RouteContext = { params: Promise<{ courseId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const userId = await requireOwnerId();
    await connectToDatabase();
    const { courseId } = await context.params;
    if (!objectIdSchema.safeParse(courseId).success) throw new DashboardError("Invalid course identifier.", 400);
    return NextResponse.json(await mutateCourse(userId, courseId, { action: "restore" }, false));
  } catch (error) {
    return dashboardErrorResponse(error);
  }
}
