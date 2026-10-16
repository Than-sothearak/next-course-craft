import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { dashboardErrorResponse, readJson, requireOwnerId } from "@/lib/dashboard/http";
import { removeWorkspaceMember, updateWorkspaceMemberRole } from "@/lib/workspaces/services";
import { updateWorkspaceMembershipSchema, workspaceIdSchema } from "@/lib/workspaces/schemas";
import { DashboardError } from "@/lib/dashboard/rules";

type Context = { params: Promise<{ workspaceId: string; memberId: string }> };

export async function DELETE(_request: Request, context: Context) {
  try {
    const userId = await requireOwnerId();
    await connectToDatabase();
    const { workspaceId, memberId } = await context.params;
    if (!workspaceIdSchema.safeParse(workspaceId).success || !workspaceIdSchema.safeParse(memberId).success)
      throw new DashboardError("Workspace member not found.", 404);
    await removeWorkspaceMember(userId, workspaceId, memberId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return dashboardErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const userId = await requireOwnerId();
    await connectToDatabase();
    const { workspaceId, memberId } = await context.params;
    if (!workspaceIdSchema.safeParse(workspaceId).success || !workspaceIdSchema.safeParse(memberId).success)
      throw new DashboardError("Workspace member not found.", 404);
    const input = await readJson(request, updateWorkspaceMembershipSchema);
    await updateWorkspaceMemberRole(userId, workspaceId, memberId, input);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return dashboardErrorResponse(error);
  }
}
