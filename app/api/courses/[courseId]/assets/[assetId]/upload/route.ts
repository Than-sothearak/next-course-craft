import { NextRequest, NextResponse } from "next/server";
import { Asset } from "@/models/Asset";
import { connectToDatabase } from "@/lib/db/mongodb";
import { assertMutationOrigin } from "@/lib/auth/http-security";
import { dashboardErrorResponse, requireOwnerId } from "@/lib/dashboard/http";
import { objectIdSchema } from "@/lib/dashboard/schemas";
import { DashboardError } from "@/lib/dashboard/rules";
import { assertCourseOwner } from "@/lib/media/services/course-assets";
import { mediaLocation, mediaStorageFile, storageProvider } from "@/lib/media/service";
import { mediaUploadInputSchema } from "@/lib/media/schemas";

type Context = { params: Promise<{ courseId: string; assetId: string }> };

export async function PUT(request: NextRequest, { params }: Context) {
  try {
    assertMutationOrigin(request);
    const userId = await requireOwnerId();
    await connectToDatabase();
    const { courseId, assetId } = await params;
    objectIdSchema.parse(courseId);
    objectIdSchema.parse(assetId);
    const ownerId = await assertCourseOwner(userId, courseId);
    const asset = await Asset.findOne({ _id: assetId, ownerId, courseId, status: "pending", storageProvider: "local" });
    if (!asset) throw new DashboardError("Pending local upload not found.", 404);
    mediaUploadInputSchema.parse({
      fileName: asset.originalName,
      contentType: asset.mimeType,
      ...(asset.mimeType === "application/octet-stream" ? { purpose: "attachment" as const } : {}),
      size: asset.size,
    });
    if (!request.body || request.headers.get("content-type") !== asset.mimeType) throw new DashboardError("The upload content type does not match.", 400);
    const length = request.headers.get("content-length");
    if (length !== null && Number(length) !== asset.size) throw new DashboardError("The upload size does not match.", 400);
    // Use the pending record's provider even if settings changed after initiation.
    await storageProvider(mediaLocation(asset).provider, asset.storageDirectory).upload({ ...mediaStorageFile(asset), body: request.body, signal: AbortSignal.any([request.signal, AbortSignal.timeout(300_000)]) });
    return new NextResponse(null, { status: 204, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return dashboardErrorResponse(error); }
}
