import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { createFolder } from "@/lib/dashboard/services/folders";
import { getDashboardData } from "@/lib/dashboard/services/list";
import { createFolderSchema, objectIdSchema } from "@/lib/dashboard/schemas";
import { dashboardErrorResponse, readJson, requireOwnerId } from "@/lib/dashboard/http";
import { DashboardError } from "@/lib/dashboard/rules";

export async function GET(request: NextRequest) {
  try {
    const ownerId = await requireOwnerId();
    await connectToDatabase();
    const params = request.nextUrl.searchParams;
    const rawParentId = params.get("parentId");
    const rawWorkspaceId = params.get("workspaceId");
    if (rawParentId && !objectIdSchema.safeParse(rawParentId).success) throw new DashboardError("Invalid folder identifier.", 400);
    if (rawWorkspaceId && !objectIdSchema.safeParse(rawWorkspaceId).success) throw new DashboardError("Invalid workspace identifier.", 400);
    const data = await getDashboardData(ownerId, { workspaceId: rawWorkspaceId, folderId: rawParentId });
    return NextResponse.json(data.folders);
  } catch (error) {
    return dashboardErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ownerId = await requireOwnerId();
    await connectToDatabase();
    const input = await readJson(request, createFolderSchema);
    return NextResponse.json(await createFolder(ownerId, input), { status: 201 });
  } catch (error) {
    return dashboardErrorResponse(error);
  }
}
