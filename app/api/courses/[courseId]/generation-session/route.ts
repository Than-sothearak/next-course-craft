import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/db/mongodb";
import { dashboardErrorResponse, readJson, requireOwnerId } from "@/lib/dashboard/http";
import { resolveCourseAccess } from "@/lib/workspaces/access";
import { requireAIEnabled } from "@/lib/auth/authorization";
import { assertMutationOrigin } from "@/lib/auth/http-security";
import { acquireGenerationLease, getGenerationLeaseStatus, GenerationLeaseBusyError, releaseGenerationLease } from "@/lib/ai/generation-lease";
import { getCourseEditor } from "@/lib/editor/services/course";
import { sessionRequestSchema } from "@/lib/ai/course-generation-session-schema";
import { getSession, planSession, approveSession, prepareNextLesson, commitNextLesson, cancelSession, cleanupCancelledSessionLessons } from "@/lib/ai/generation/session-workflow";

export const maxDuration = 960;
type Context = { params: Promise<{ courseId: string }> };
export async function GET(request: NextRequest, { params }: Context) {
  try {
    const userId = await requireOwnerId();
    await connectToDatabase();
    const { courseId } = await params;
    const { ownerId } = await resolveCourseAccess(userId, courseId, "courses.edit");
    const [session, lease] = await Promise.all([
      getSession({ ownerId, courseId }, request.nextUrl.searchParams.get("sessionId") ?? undefined),
      getGenerationLeaseStatus(ownerId, courseId),
    ]);
    return NextResponse.json(session ? { ...session, lease } : null, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return dashboardErrorResponse(error); }
}
export async function POST(request: NextRequest, { params }: Context) {
  let lease: Awaited<ReturnType<typeof acquireGenerationLease>> | undefined;
  let cleanupTarget: { ownerId: string; courseId: string; sessionId: string } | undefined;
  let cancellationAction = false;
  try {
    assertMutationOrigin(request);
    const userId = await requireOwnerId();
    await connectToDatabase();
    const { courseId } = await params;
    const { ownerId } = await resolveCourseAccess(userId, courseId, "courses.edit");
    const body = await readJson(request, sessionRequestSchema);
    const scope = { ownerId, courseId };
    if (body.action !== "plan") cleanupTarget = { ...scope, sessionId: body.sessionId };
    if (body.action === "cancel") {
      cancellationAction = true;
      const result = await cancelSession(scope, body.sessionId);
      if (result.changed) revalidatePath("/dashboard", "page");
      return NextResponse.json({ session: result.session, removedLessonIds: result.discardedLessonIds, changed: result.changed });
    }
    await resolveCourseAccess(userId, courseId, "ai.generate");
    await requireAIEnabled();
    try {
      lease = await acquireGenerationLease(ownerId, courseId);
    } catch (error) {
      if (!(error instanceof GenerationLeaseBusyError) || (body.action !== "prepare" && body.action !== "commit")) throw error;
      // Another request is doing the work. Return progress without submitting
      // provider work or treating routine contention as a course save failure.
      const [session, lock] = await Promise.all([getSession(scope, body.sessionId), getGenerationLeaseStatus(ownerId, courseId)]);
      const progress = { ...session, lease: lock };
      return NextResponse.json(body.action === "commit" ? { session: progress, editor: await getCourseEditor(ownerId, courseId) } : progress, {
        status: 202,
        headers: { "Cache-Control": "no-store", "Retry-After": "2" },
      });
    }
    switch (body.action) {
      case "plan": return NextResponse.json(await planSession(scope, body.input, body.sourceJobId));
      case "approve": {
        const result = await approveSession(scope, body.sessionId, body.outline, body.mode, body.revision);
        if (result.editor.revision !== body.revision) revalidatePath("/dashboard", "page");
        return NextResponse.json(result);
      }
      case "prepare": return NextResponse.json(await prepareNextLesson(scope, body.sessionId));
      case "commit": {
        if (body.revision === undefined) throw new Error("A course revision is required.");
        const result = await commitNextLesson(scope, body.sessionId, body.revision);
        if (result.editor.revision !== body.revision) revalidatePath("/dashboard", "page");
        return NextResponse.json(result);
      }
    }
  } catch (error) { return dashboardErrorResponse(error); }
  finally {
    if (lease) await releaseGenerationLease(lease).catch(() => console.error("Generation lease release failed; it will expire automatically."));
    if (cleanupTarget && !cancellationAction) {
      try {
        const cleanup = await cleanupCancelledSessionLessons(cleanupTarget, cleanupTarget.sessionId);
        if (cleanup.changed) revalidatePath("/dashboard", "page");
      } catch (error) {
        // Do not replace the generation request's JSON response if deferred
        // cancellation cleanup fails; the next cancel request can retry it.
        console.error("Deferred cancelled-generation cleanup failed.", error);
      }
    }
  }
}
