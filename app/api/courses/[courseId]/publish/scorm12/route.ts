import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db/mongodb";
import { dashboardErrorResponse, requireOwnerId } from "@/lib/dashboard/http";
import { DashboardError } from "@/lib/dashboard/rules";
import { buildScorm12Package } from "@/lib/scorm/package";
import { resolveCourseAccess } from "@/lib/workspaces/access";
import { getCourseAuthorName } from "@/lib/editor/services/course";

const paramsSchema = z.object({ courseId: z.string().regex(/^[\da-f]{24}$/i) });

export async function POST(_request: NextRequest, context: { params: Promise<{ courseId: string }> }) {
  try {
    const userId = await requireOwnerId();
    const parsed = paramsSchema.safeParse(await context.params);
    if (!parsed.success) throw new DashboardError("Course not found.", 404);
    await connectToDatabase();
    const { ownerId } = await resolveCourseAccess(userId, parsed.data.courseId, "edit");
    const result = await buildScorm12Package({
      ownerId,
      courseId: parsed.data.courseId,
      authorName: await getCourseAuthorName(ownerId, parsed.data.courseId),
    });
    const archiveBody = new Uint8Array(
      result.archive.buffer,
      result.archive.byteOffset,
      result.archive.byteLength,
    );
    return new NextResponse(archiveBody, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Content-Length": String(result.archive.byteLength),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return dashboardErrorResponse(error);
  }
}
