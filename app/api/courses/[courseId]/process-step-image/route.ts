import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { dashboardErrorResponse, readJson, requireOwnerId } from "@/lib/dashboard/http";
import { objectIdSchema } from "@/lib/dashboard/schemas";
import { DashboardError } from "@/lib/dashboard/rules";
import { assertMutationOrigin } from "@/lib/auth/http-security";
import { requireAIEnabled } from "@/lib/auth/authorization";
import { resolveCourseAccess } from "@/lib/workspaces/access";
import { acquireGenerationLease, releaseGenerationLease } from "@/lib/ai/generation-lease";
import { createGeneratedImageAsset } from "@/lib/ai/generation/images";
import { processStepImagePrompt, processStepImageRequestSchema } from "@/lib/ai/process-step-image";
import { processStepMediaSchema } from "@/lib/schemas/block";
import { Asset } from "@/models/Asset";

export const maxDuration = 120;
type Context = { params: Promise<{ courseId: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  let lease: Awaited<ReturnType<typeof acquireGenerationLease>> | undefined;
  try {
    assertMutationOrigin(request);
    const userId = await requireOwnerId();
    await connectToDatabase();
    const { courseId } = await params;
    if (!objectIdSchema.safeParse(courseId).success) throw new DashboardError("Invalid course identifier.", 400);
    const { ownerId } = await resolveCourseAccess(userId, courseId, "courses.edit");
    await resolveCourseAccess(userId, courseId, "ai.generate");
    await requireAIEnabled();
    const input = await readJson(request, processStepImageRequestSchema);
    lease = await acquireGenerationLease(ownerId, courseId);
    const generated = await createGeneratedImageAsset(ownerId, courseId, processStepImagePrompt(input), { purpose: "process-step-guide" });
    const access = await resolveCourseAccess(userId, courseId, "courses.edit");
    if (access.ownerId !== ownerId) throw new DashboardError("Course ownership changed. Please reload the editor.", 409);
    const asset = await Asset.findOne({ _id: generated.id, ownerId, courseId, status: "ready" })
      .select("originalName mimeType size").lean();
    if (!asset) throw new DashboardError("The generated image could not be found in course media.", 502);
    const media = processStepMediaSchema.parse({ src: generated.src, fileName: asset.originalName, mimeType: asset.mimeType, size: asset.size });
    return NextResponse.json({ media }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return dashboardErrorResponse(error);
  } finally {
    if (lease) await releaseGenerationLease(lease).catch(() => console.error("Generation lease release failed; it will expire automatically."));
  }
}
