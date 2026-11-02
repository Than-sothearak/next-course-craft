import { NextRequest } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db/mongodb";
import { dashboardErrorResponse, requireOwnerId } from "@/lib/dashboard/http";
import { DashboardError } from "@/lib/dashboard/rules";
import { buildCourseHandoutPdf } from "@/lib/pdf/course-handout";
import { resolveCourseAccess } from "@/lib/workspaces/access";
import { getCourseAuthorName } from "@/lib/editor/services/course";
import { progressExportResponse } from "@/lib/export/progress-stream";

const paramsSchema = z.object({ courseId: z.string().regex(/^[\da-f]{24}$/i) });

export async function POST(request: NextRequest, context: { params: Promise<{ courseId: string }> }) {
  try {
    const userId = await requireOwnerId();
    const parsed = paramsSchema.safeParse(await context.params);
    if (!parsed.success) throw new DashboardError("Course not found.", 404);
    await connectToDatabase();
    const { ownerId } = await resolveCourseAccess(userId, parsed.data.courseId, "courses.export");
    await resolveCourseAccess(userId, parsed.data.courseId, "courses.publish");
    return progressExportResponse(request, async (report, signal) => {
      const result = await buildCourseHandoutPdf({
        ownerId,
        courseId: parsed.data.courseId,
        authorName: await getCourseAuthorName(ownerId, parsed.data.courseId),
        signal,
        report: (stage, value) => report({ stage, value }),
      });
      return { data: new Uint8Array(result.pdf), filename: result.filename };
    });
  } catch (error) {
    return dashboardErrorResponse(error);
  }
}
