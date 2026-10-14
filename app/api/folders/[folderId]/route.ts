import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { deleteFolder, updateFolder } from "@/lib/dashboard/services/folders";
import { objectIdSchema, updateFolderSchema } from "@/lib/dashboard/schemas";
import { dashboardErrorResponse, readJson, requireOwnerId } from "@/lib/dashboard/http";
import { DashboardError } from "@/lib/dashboard/rules";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ folderId: string }> };

async function validatedFolderId(context: RouteContext) {
  const { folderId } = await context.params;
  if (!objectIdSchema.safeParse(folderId).success) throw new DashboardError("Invalid folder identifier.", 400);
  return folderId;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const ownerId = await requireOwnerId();
    await connectToDatabase();
    const folderId = await validatedFolderId(context);
    const input = await readJson(request, updateFolderSchema);
    return NextResponse.json(await updateFolder(ownerId, folderId, input));
  } catch (error) {
    return dashboardErrorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const ownerId = await requireOwnerId();
    await connectToDatabase();
    const folderId = await validatedFolderId(context);
    await deleteFolder(ownerId, folderId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return dashboardErrorResponse(error);
  }
}
