import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { dashboardErrorResponse, readJson, requireOwnerId } from "@/lib/dashboard/http";
import { createWorkspaceInvitationSchema, workspaceIdSchema } from "@/lib/workspaces/schemas";
import { createWorkspaceInvitation, getWorkspaceRoster } from "@/lib/workspaces/services";
import { DashboardError } from "@/lib/dashboard/rules";

type Context = { params: Promise<{ workspaceId: string }> };

async function readWorkspaceId(context: Context) {
  const { workspaceId } = await context.params;
  if (!workspaceIdSchema.safeParse(workspaceId).success)
    throw new DashboardError("Invalid workspace identifier.", 400);
  return workspaceId;
}

export async function GET(_request: NextRequest, context: Context) {
  try {
    const userId = await requireOwnerId();
    await connectToDatabase();
    return NextResponse.json(await getWorkspaceRoster(userId, await readWorkspaceId(context)));
  } catch (error) {
    return dashboardErrorResponse(error);
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const userId = await requireOwnerId();
    await connectToDatabase();
    const workspaceId = await readWorkspaceId(context);
    const input = await readJson(request, createWorkspaceInvitationSchema);
    return NextResponse.json(await createWorkspaceInvitation(userId, workspaceId, input), { status: 201 });
  } catch (error) {
    return dashboardErrorResponse(error);
  }
}
