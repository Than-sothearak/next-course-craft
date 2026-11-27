import type { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { dashboardErrorResponse } from "@/lib/dashboard/http";
import { getPublicCourseAsset } from "@/lib/publishing/share";
import { mediaFileResponse } from "@/lib/media/file-response";

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string; assetId: string }> }) {
  try {
    const { token, assetId } = await params;
    await connectToDatabase();
    const asset = await getPublicCourseAsset(token, assetId);
    return await mediaFileResponse(request, asset);
  } catch (error) {
    const response = dashboardErrorResponse(error);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
}
