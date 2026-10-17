import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { dashboardErrorResponse, requireOwnerId } from "@/lib/dashboard/http";
import { objectIdSchema } from "@/lib/dashboard/schemas";
import { DashboardError } from "@/lib/dashboard/rules";
import { resolveCourseAccess } from "@/lib/workspaces/access";
import { requireAIEnabled } from "@/lib/auth/authorization";
import { acquireGenerationLease, getGenerationLeaseStatus, releaseGenerationLease } from "@/lib/ai/generation-lease";
import { assertMutationOrigin } from "@/lib/auth/http-security";
import { generationSettingsError, parseCourseGenerationForm } from "@/lib/ai/course-generation-request";
import {
  advanceSourceGenerationJob,
  cancelSourceGenerationJob,
  createSourceGenerationJob,
  generateCourseDraft,
  getLastCompletedSourceGenerationJob,
  getSourceGenerationJob,
  startSourceGenerationJob,
} from "@/lib/ai/course-generation";

export const maxDuration = 300;

type Context = { params: Promise<{ courseId: string }> };
const maximumSourceBytes = 12 * 1024 * 1024;

function readSourceFile(value: FormDataEntryValue | null) {
  if (value === null) return undefined;
  if (!(value instanceof File))
    throw new DashboardError("Choose a PDF or PowerPoint file.", 400);
  const name = value.name.replace(/[\\/\u0000-\u001f\u007f]/g, "").trim();
  const extension = name.toLowerCase().split(".").pop();
  if (!name || value.size < 1 || value.size > maximumSourceBytes)
    throw new DashboardError(
      "Source files must be between 1 byte and 12 MB.",
      400,
    );

  const formats = {
    pdf: { contentType: "application/pdf", signature: Buffer.from("%PDF-") },
    ppt: {
      contentType: "application/vnd.ms-powerpoint",
      signature: Buffer.from([0xd0, 0xcf, 0x11, 0xe0]),
    },
    pptx: {
      contentType:
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      signature: Buffer.from("PK\u0003\u0004", "binary"),
    },
  } as const;
  if (!extension || !(extension in formats))
    throw new DashboardError(
      "Upload a PDF or PowerPoint file (.pdf, .ppt, or .pptx).",
      400,
    );
  const format = formats[extension as keyof typeof formats];
  if (value.type && value.type !== format.contentType)
    throw new DashboardError(
      "The selected file type does not match its extension.",
      400,
    );
  return value.arrayBuffer().then((arrayBuffer) => {
    const bytes = Buffer.from(arrayBuffer);
    if (
      bytes.length < format.signature.length ||
      !bytes.subarray(0, format.signature.length).equals(format.signature)
    )
      throw new DashboardError(
        "The selected file is not a valid PDF or PowerPoint document.",
        400,
      );
    return {
      name,
      contentType: format.contentType,
      bytes,
    };
  });
}

export async function GET(_request: NextRequest, context: Context) {
  try {
    const userId = await requireOwnerId();
    await connectToDatabase();
    const { courseId } = await context.params;
    if (!objectIdSchema.safeParse(courseId).success)
      throw new DashboardError("Invalid course identifier.", 400);
    const { ownerId } = await resolveCourseAccess(userId, courseId, "courses.edit");
    return NextResponse.json(await getLastCompletedSourceGenerationJob({ ownerId, courseId }), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return dashboardErrorResponse(error);
  }
}

export async function POST(request: NextRequest, context: Context) {
  let lease: Awaited<ReturnType<typeof acquireGenerationLease>> | undefined;
  try {
    assertMutationOrigin(request);
    const userId = await requireOwnerId();
    await connectToDatabase();
    const { courseId } = await context.params;
    if (!objectIdSchema.safeParse(courseId).success)
      throw new DashboardError("Invalid course identifier.", 400);
    const { ownerId } = await resolveCourseAccess(userId, courseId, "courses.edit");

    const formData = await request.formData();
    const action = String(formData.get("action") ?? "generate");
    if (![
      "generate",
      "analyzeSource",
      "advanceGeneration",
      "getGeneration",
      "getGenerationLease",
      "cancelGeneration",
    ].includes(action))
      throw new DashboardError("Unsupported course generation action.", 400);
    const jobId = String(formData.get("jobId") ?? "");
    if (action === "getGenerationLease")
      return NextResponse.json(await getGenerationLeaseStatus(ownerId, courseId));
    if (["generate", "analyzeSource", "advanceGeneration"].includes(action)) {
      await resolveCourseAccess(userId, courseId, "ai.generate");
      await requireAIEnabled();
      lease = await acquireGenerationLease(ownerId, courseId);
    }
    if (action === "getGeneration") {
      if (!jobId) throw new DashboardError("A generation job identifier is required.", 400);
      return NextResponse.json(await getSourceGenerationJob({ ownerId, courseId, jobId }));
    }
    if (action === "advanceGeneration") {
      if (!jobId) throw new DashboardError("A generation job identifier is required.", 400);
      return NextResponse.json(await advanceSourceGenerationJob({ ownerId, courseId, jobId }));
    }
    if (action === "cancelGeneration") {
      if (!jobId) throw new DashboardError("A generation job identifier is required.", 400);
      return NextResponse.json(await cancelSourceGenerationJob({ ownerId, courseId, jobId }));
    }
    const sourceFile = await readSourceFile(formData.get("file"));
    if (sourceFile?.contentType === "application/vnd.ms-powerpoint")
      throw new DashboardError("Legacy .ppt files cannot be page-indexed reliably. Save the presentation as .pptx or PDF, then upload it again.", 400);
    const inputResult = parseCourseGenerationForm(formData, Boolean(sourceFile || jobId));
    if (!inputResult.success)
      throw new DashboardError(generationSettingsError(inputResult.error.issues), 400);
    if (action === "analyzeSource" || (action === "generate" && sourceFile && !jobId)) {
      if (!sourceFile)
        throw new DashboardError("Upload a PDF or PowerPoint file to generate a course.", 400);
      const generationJob = await createSourceGenerationJob({
        ownerId,
        courseId,
        input: inputResult.data,
        sourceFile,
      });
      return NextResponse.json(generationJob, { status: 200 });
    }
    if (jobId) {
      return NextResponse.json(await startSourceGenerationJob({
        ownerId,
        courseId,
        jobId,
        input: inputResult.data,
      }));
    }
    if (!inputResult.data.prompt.trim() && !sourceFile)
      throw new DashboardError(
        "Write a course prompt or upload a source file.",
        400,
      );

    const generatedCourse = await generateCourseDraft({
      ownerId,
      courseId,
      input: inputResult.data,
      sourceFile,
    });
    return NextResponse.json(generatedCourse, { status: 200 });
  } catch (error) {
    return dashboardErrorResponse(error);
  } finally {
    if (lease) await releaseGenerationLease(lease).catch(() => console.error("Generation lease release failed; it will expire automatically."));
  }
}
