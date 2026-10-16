import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { dashboardErrorResponse, requireOwnerId } from "@/lib/dashboard/http";
import { revokeWorkspaceInvitation } from "@/lib/workspaces/services";
import { workspaceIdSchema } from "@/lib/workspaces/schemas";
import { DashboardError } from "@/lib/dashboard/rules";

type Context = { params: Promise<{ workspaceId: string; invitationId: string }> };

export async function DELETE(_request: Request, context: Context) {
  try {
    const userId = await requireOwnerId();
    await connectToDatabase();
    const { workspaceId, invitationId } = await context.params;
    if (!workspaceIdSchema.safeParse(workspaceId).success || !workspaceIdSchema.safeParse(invitationId).success)
      throw new DashboardError("Invitation not found.", 404);
    await revokeWorkspaceInvitation(userId, workspaceId, invitationId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return dashboardErrorResponse(error);
  }
}
