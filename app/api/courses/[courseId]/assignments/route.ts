import { NextRequest, NextResponse } from "next/server";
import { requireOwnerId, dashboardErrorResponse, readJson } from "@/lib/dashboard/http";
import { assignCourse, getCourseAssignments, removeCourseAssignment } from "@/lib/admin/courses";
import { assignmentSchema, removeAssignmentSchema } from "@/lib/admin/schemas";
import { assertMutationOrigin } from "@/lib/auth/http-security";

type Context = { params: Promise<{ courseId: string }> };
export async function GET(_request: NextRequest, context: Context) {
  try {
    const actorId = await requireOwnerId();
    return NextResponse.json(await getCourseAssignments(actorId, (await context.params).courseId), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return dashboardErrorResponse(error); }
}
export async function PUT(request: NextRequest, context: Context) {
  try {
    assertMutationOrigin(request);
    const actorId = await requireOwnerId();
    return NextResponse.json(await assignCourse(actorId, (await context.params).courseId, await readJson(request, assignmentSchema)));
  } catch (error) { return dashboardErrorResponse(error); }
}
export async function DELETE(request: NextRequest, context: Context) {
  try {
    assertMutationOrigin(request);
    const actorId = await requireOwnerId();
    await removeCourseAssignment(actorId, (await context.params).courseId, (await readJson(request, removeAssignmentSchema)).userId);
    return new NextResponse(null, { status: 204 });
  } catch (error) { return dashboardErrorResponse(error); }
}
