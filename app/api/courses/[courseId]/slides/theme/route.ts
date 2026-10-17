import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { dashboardErrorResponse, readJson, requireOwnerId } from "@/lib/dashboard/http";
import { resolveCourseAccess } from "@/lib/workspaces/access";
import { getSlideCourseTheme, saveSlideCourseTheme } from "@/lib/slides/service";
import { slideThemeUpdateSchema } from "@/lib/slides/themes";

type Context = { params: Promise<{ courseId: string }> };
export async function GET(_request: NextRequest, { params }: Context) {
  try {
    const userId = await requireOwnerId();
    await connectToDatabase();
    const { courseId } = await params;
    const { ownerId } = await resolveCourseAccess(userId, courseId, "courses.edit");
    return NextResponse.json(await getSlideCourseTheme(ownerId, courseId), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return dashboardErrorResponse(error); }
}
export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    const userId = await requireOwnerId();
    await connectToDatabase();
    const { courseId } = await params;
    const { ownerId } = await resolveCourseAccess(userId, courseId, "courses.edit");
    const input = await readJson(request, slideThemeUpdateSchema);
    return NextResponse.json(await saveSlideCourseTheme(ownerId, courseId, input));
  } catch (error) { return dashboardErrorResponse(error); }
}
