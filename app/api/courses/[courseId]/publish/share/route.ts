import { NextResponse, type NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { dashboardErrorResponse, requireOwnerId } from "@/lib/dashboard/http";
import { assertMutationOrigin } from "@/lib/auth/http-security";
import { getCourseShare, publishCourseShare, revokeCourseShare } from "@/lib/publishing/share";

type Context = { params: Promise<{ courseId: string }> };

async function handle(request: NextRequest, context: Context, action: "read" | "publish" | "revoke") {
  try {
    assertMutationOrigin(request);
    const userId = await requireOwnerId();
    const { courseId } = await context.params;
    await connectToDatabase();
    const share = action === "read" ? await getCourseShare(userId, courseId)
      : action === "publish" ? await publishCourseShare(userId, courseId)
      : await revokeCourseShare(userId, courseId);
    return NextResponse.json({ share: share ?? null }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const response = dashboardErrorResponse(error);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
}

export const GET = (request: NextRequest, context: Context) => handle(request, context, "read");
export const POST = (request: NextRequest, context: Context) => handle(request, context, "publish");
export const DELETE = (request: NextRequest, context: Context) => handle(request, context, "revoke");
