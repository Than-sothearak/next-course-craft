import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { createCourse } from "@/lib/dashboard/services/courses";
import { getDashboardData } from "@/lib/dashboard/services/list";
import { createCourseSchema, objectIdSchema } from "@/lib/dashboard/schemas";
import { dashboardErrorResponse, readJson, requireOwnerId } from "@/lib/dashboard/http";
import { DashboardError } from "@/lib/dashboard/rules";

export async function GET(request: NextRequest) {
  try {
    const ownerId = await requireOwnerId();
    await connectToDatabase();
    const params = request.nextUrl.searchParams;
    const rawWorkspaceId = params.get("workspaceId");
    if (rawWorkspaceId && !objectIdSchema.safeParse(rawWorkspaceId).success) throw new DashboardError("Invalid workspace identifier.", 400);
    const rawFolderId = params.get("folderId");
    if (rawFolderId && !objectIdSchema.safeParse(rawFolderId).success) throw new DashboardError("Invalid folder identifier.", 400);
    const data = await getDashboardData(ownerId, { workspaceId: rawWorkspaceId, folderId: rawFolderId, q: params.get("q") ?? "", status: "all" });
    return NextResponse.json(data.courses);
  } catch (error) {
    return dashboardErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ownerId = await requireOwnerId();
    await connectToDatabase();
    const input = await readJson(request, createCourseSchema);
    return NextResponse.json(await createCourse(ownerId, input), { status: 201 });
  } catch (error) {
    return dashboardErrorResponse(error);
  }
}
