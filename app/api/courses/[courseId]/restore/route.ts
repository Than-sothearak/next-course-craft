import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { dashboardErrorResponse, requireOwnerId } from "@/lib/dashboard/http";
import { restoreCourse } from "@/lib/dashboard/services/courses";
import { objectIdSchema } from "@/lib/dashboard/schemas";
import { DashboardError } from "@/lib/dashboard/rules";
import { resolveCourseAccess } from "@/lib/workspaces/access";

type RouteContext = { params: Promise<{ courseId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const userId = await requireOwnerId();
    await connectToDatabase();
    const { courseId } = await context.params;
    if (!objectIdSchema.safeParse(courseId).success) throw new DashboardError("Invalid course identifier.", 400);
    const { ownerId } = await resolveCourseAccess(userId, courseId, "manage", { includeDeleted: true });
    return NextResponse.json(await restoreCourse(ownerId, courseId));
  } catch (error) {
    return dashboardErrorResponse(error);
  }
}
