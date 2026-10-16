import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import { dashboardErrorResponse, requireOwnerId } from "@/lib/dashboard/http";
import { DashboardError } from "@/lib/dashboard/rules";
import { buildScorm2004Package } from "@/lib/scorm/package";

const paramsSchema = z.object({ courseId: z.string().regex(/^[\da-f]{24}$/i) });

export async function POST(_request: NextRequest, context: { params: Promise<{ courseId: string }> }) {
  try {
    const ownerId = await requireOwnerId();
    const session = await auth();
    const parsed = paramsSchema.safeParse(await context.params);
    if (!parsed.success) throw new DashboardError("Course not found.", 404);
    await connectToDatabase();
    const result = await buildScorm2004Package({
      ownerId,
      courseId: parsed.data.courseId,
      authorName: session?.user?.name?.trim() || session?.user?.email || "Course author",
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
