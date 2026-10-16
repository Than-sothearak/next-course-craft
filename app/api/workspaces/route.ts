import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { dashboardErrorResponse, readJson, requireOwnerId } from "@/lib/dashboard/http";
import { createWorkspaceSchema } from "@/lib/workspaces/schemas";
import { createWorkspace, listWorkspaces } from "@/lib/workspaces/services";

export async function GET() {
  try {
    const userId = await requireOwnerId();
    await connectToDatabase();
    return NextResponse.json(await listWorkspaces(userId));
  } catch (error) {
    return dashboardErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireOwnerId();
    await connectToDatabase();
    const input = await readJson(request, createWorkspaceSchema);
    return NextResponse.json(await createWorkspace(userId, input), { status: 201 });
  } catch (error) {
    return dashboardErrorResponse(error);
  }
}
