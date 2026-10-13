import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db/mongodb";
import { dashboardErrorResponse, readJson, requireOwnerId } from "@/lib/dashboard/http";
import { copyCourseLesson } from "@/lib/editor/service";
import { editorLessonSchema } from "@/lib/editor/schemas";

export const runtime = "nodejs";

const copyInputSchema = z.object({
  destinationCourseId: z.string().regex(/^[\da-f]{24}$/i),
  lesson: editorLessonSchema,
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const ownerId = await requireOwnerId();
    await connectToDatabase();
    const { courseId } = await params;
    const input = await readJson(request, copyInputSchema);
    return NextResponse.json(await copyCourseLesson(ownerId, courseId, input.destinationCourseId, input.lesson), { status: 201 });
  } catch (error) {
    return dashboardErrorResponse(error);
  }
}
