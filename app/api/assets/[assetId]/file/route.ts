import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { dashboardErrorResponse, requireOwnerId } from "@/lib/dashboard/http";
import { objectIdSchema } from "@/lib/dashboard/schemas";
import { getOwnedMediaAsset } from "@/lib/media/services/assets";
import { mediaFileResponse } from "@/lib/media/file-response";
import { DashboardError } from "@/lib/dashboard/rules";

type Context = { params: Promise<{ assetId: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const ownerId = await requireOwnerId();
    await connectToDatabase();
    const { assetId } = await params;
    if (!objectIdSchema.safeParse(assetId).success)
      throw new DashboardError("Invalid asset identifier.", 400);
    const asset = await getOwnedMediaAsset(ownerId, assetId);
    return await mediaFileResponse(request, asset);
  } catch (error) {
    const response = dashboardErrorResponse(error);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
}
