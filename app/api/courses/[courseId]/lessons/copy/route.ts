import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db/mongodb";
import { dashboardErrorResponse, readJson, requireOwnerId } from "@/lib/dashboard/http";
import { copyCourseLesson } from "@/lib/editor/services/lessons";
import { editorLessonSchema } from "@/lib/editor/schemas";
import { resolveCourseAccess } from "@/lib/workspaces/access";
import { DashboardError } from "@/lib/dashboard/rules";

const copyInputSchema = z.object({
  destinationCourseId: z.string().regex(/^[\da-f]{24}$/i),
  lesson: editorLessonSchema,
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const userId = await requireOwnerId();
    await connectToDatabase();
    const { courseId } = await params;
    const input = await readJson(request, copyInputSchema);
    const [source, destination] = await Promise.all([
      resolveCourseAccess(userId, courseId, "edit"),
      resolveCourseAccess(userId, input.destinationCourseId, "edit"),
    ]);
    if (destination.ownerId !== source.ownerId || destination.workspaceId !== source.workspaceId)
      throw new DashboardError("Lessons can only be copied inside the same workspace.", 400);
    const ownerId = source.ownerId;
    return NextResponse.json(await copyCourseLesson(ownerId, courseId, input.destinationCourseId, input.lesson), { status: 201 });
  } catch (error) {
    return dashboardErrorResponse(error);
  }
}
