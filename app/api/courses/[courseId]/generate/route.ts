import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { dashboardErrorResponse, requireOwnerId } from "@/lib/dashboard/http";
import { objectIdSchema } from "@/lib/dashboard/schemas";
import { DashboardError } from "@/lib/dashboard/rules";
import { assertCourseOwner } from "@/lib/media/services/course-assets";
import { courseGenerationInputSchema } from "@/lib/ai/course-generation-schemas";
import { generateCourseDraft } from "@/lib/ai/course-generation";

export const runtime = "nodejs";
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

export async function POST(request: NextRequest, context: Context) {
  try {
    const ownerId = await requireOwnerId();
    await connectToDatabase();
    const { courseId } = await context.params;
    if (!objectIdSchema.safeParse(courseId).success)
      throw new DashboardError("Invalid course identifier.", 400);
    await assertCourseOwner(ownerId, courseId);

    const formData = await request.formData();
    const filePromise = readSourceFile(formData.get("file"));
    const inputResult = courseGenerationInputSchema.safeParse({
      prompt: String(formData.get("prompt") ?? ""),
      audience: String(formData.get("audience") ?? ""),
      level: String(formData.get("level") ?? "beginner"),
      lessonCount: Number(formData.get("lessonCount") ?? 5),
      template: String(formData.get("template") ?? "custom"),
      includeImages: formData.get("includeImages") === "true",
      courseTitle: String(formData.get("courseTitle") ?? ""),
      courseDescription: String(formData.get("courseDescription") ?? ""),
      model: formData.has("model") ? String(formData.get("model")) : undefined,
    });
    if (!inputResult.success)
      throw new DashboardError(
        "Check the generation settings and try again.",
        400,
      );
    const sourceFile = await filePromise;
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
  }
}
