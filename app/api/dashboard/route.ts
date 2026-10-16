import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { getDashboardData } from "@/lib/dashboard/services/list";
import { DashboardError } from "@/lib/dashboard/rules";
import { dashboardErrorResponse, requireOwnerId } from "@/lib/dashboard/http";
import { objectIdSchema } from "@/lib/dashboard/schemas";

export async function GET(request: NextRequest) {
  try {
    const ownerId = await requireOwnerId();
    await connectToDatabase();
    const params = request.nextUrl.searchParams;
    const rawWorkspaceId = params.get("workspaceId");
    if (rawWorkspaceId && !objectIdSchema.safeParse(rawWorkspaceId).success)
      throw new DashboardError("Invalid workspace identifier.", 400);
    const rawFolderId = params.get("folderId");
    if (rawFolderId && !objectIdSchema.safeParse(rawFolderId).success)
      throw new DashboardError("Invalid folder identifier.", 400);
    const rawStatus = params.get("status");
    const status =
      rawStatus === "draft" ||
      rawStatus === "published" ||
      rawStatus === "archived"
        ? rawStatus
        : "all";
    const rawSort = params.get("sort");
    const sort =
      rawSort === "title" || rawSort === "created" ? rawSort : "updated";
    const data = await getDashboardData(ownerId, {
      workspaceId: rawWorkspaceId,
      folderId: rawFolderId,
      q: params.get("q") ?? "",
      status,
      sort,
    });
    return NextResponse.json(data);
  } catch (error) {
    return dashboardErrorResponse(error);
  }
}
