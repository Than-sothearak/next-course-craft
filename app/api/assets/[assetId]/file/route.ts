import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { dashboardErrorResponse, requireOwnerId } from "@/lib/dashboard/http";
import { objectIdSchema } from "@/lib/dashboard/schemas";
import { getOwnedMediaAsset } from "@/lib/media/services/assets";
import { readStoredMedia } from "@/lib/media/service";
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
    const range = request.headers.get("range");
    if (range && !/^bytes=\d*-\d*$/.test(range))
      throw new DashboardError("Invalid media range.", 400);
    const upstream = await readStoredMedia(asset, {
      range: range ?? undefined,
      signal: request.signal,
    });
    if (!upstream.ok && upstream.status !== 416)
      throw new DashboardError("The media file could not be read.", 502);
    // The browser never receives a reusable S3 URL. Each new media/range request
    // rechecks approval, current permissions and course access.
    const headers = new Headers({
      "Content-Type": asset.mimeType,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    });
    headers.set(
      "Content-Disposition",
      asset.mimeType.startsWith("application/") ||
        asset.mimeType.startsWith("text/")
        ? `attachment; filename*=UTF-8''${encodeURIComponent(asset.originalName)}`
        : "inline",
    );
    for (const name of ["content-length", "content-range", "accept-ranges"]) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (error) {
    const response = dashboardErrorResponse(error);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
}
