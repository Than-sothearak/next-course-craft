import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { dashboardErrorResponse, requireOwnerId } from "@/lib/dashboard/http";
import { objectIdSchema } from "@/lib/dashboard/schemas";
import { getOwnedMediaAsset } from "@/lib/media/services/assets";
import { createMediaReadUrl } from "@/lib/media/storage";
import { DashboardError } from "@/lib/dashboard/rules";

export const runtime = "nodejs";
type Context = { params: Promise<{ assetId: string }> };

export async function GET(_request: NextRequest, { params }: Context) {
  try {
    const ownerId = await requireOwnerId();
    await connectToDatabase();
    const { assetId } = await params;
    if (!objectIdSchema.safeParse(assetId).success) throw new DashboardError("Invalid asset identifier.", 400);
    const asset = await getOwnedMediaAsset(ownerId, assetId);
    const url = await createMediaReadUrl({ objectKey: asset.objectKey, contentType: asset.mimeType });
    return NextResponse.redirect(url, { status: 307, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return dashboardErrorResponse(error);
  }
}
