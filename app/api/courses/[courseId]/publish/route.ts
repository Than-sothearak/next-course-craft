import { NextRequest, NextResponse } from "next/server";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db/mongodb";
import { dashboardErrorResponse, requireOwnerId } from "@/lib/dashboard/http";
import { DashboardError } from "@/lib/dashboard/rules";
import { getCourseEditor } from "@/lib/editor/services/course";
import { Asset } from "@/models/Asset";
import { createMediaReadUrl } from "@/lib/media/storage";
import { validateQuizAssessments } from "@/lib/interactive/quiz-assessment";
import { resolveCourseAccess } from "@/lib/workspaces/access";
import { getCourseAuthorName } from "@/lib/editor/services/course";

const paramsSchema = z.object({ courseId: z.string().regex(/^[\da-f]{24}$/i) });
const dataUriPattern = /\/api\/assets\/([\da-f]{24})\/file/g;

function replaceAssetSources(value: unknown, assets: Map<string, string>): unknown {
  if (typeof value === "string") return value.replace(dataUriPattern, (match, id: string) => assets.get(id) ?? match);
  if (Array.isArray(value)) return value.map((item) => replaceAssetSources(item, assets));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceAssetSources(item, assets)]));
  return value;
}

export async function POST(_request: NextRequest, context: { params: Promise<{ courseId: string }> }) {
  try {
    const userId = await requireOwnerId();
    const parsed = paramsSchema.safeParse(await context.params);
    if (!parsed.success) throw new DashboardError("Course not found.", 404);
    await connectToDatabase();
    const { ownerId } = await resolveCourseAccess(userId, parsed.data.courseId, "courses.export");
    await resolveCourseAccess(userId, parsed.data.courseId, "courses.publish");
    const course = await getCourseEditor(ownerId, parsed.data.courseId);
    if (course.editorType === "slide")
      throw new DashboardError("Slide course HTML publishing is not available yet.", 409);
    const assessmentIssue = validateQuizAssessments(course.lessons);
    if (assessmentIssue) throw new DashboardError(assessmentIssue, 422);
    const exportDir = join(process.cwd(), "public", "course-export");
    let files: string[];
    try { files = await readdir(join(exportDir, "assets")); }
    catch { throw new DashboardError("Build the course export before publishing (npm run build:export).", 503); }
    const jsName = files.find((name) => name.endsWith(".js"));
    const cssName = files.find((name) => name.endsWith(".css"));
    if (!jsName || !cssName) throw new DashboardError("The course export build is incomplete. Rebuild it before publishing.", 503);

    const referencedAssetIds = new Set<string>();
    const serialized = JSON.stringify(course);
    for (const match of serialized.matchAll(dataUriPattern)) referencedAssetIds.add(match[1]);
    const media = referencedAssetIds.size ? await Asset.find({ _id: { $in: [...referencedAssetIds] }, ownerId, courseId: parsed.data.courseId, status: "ready" }).lean() : [];
    if (media.length !== referencedAssetIds.size) throw new DashboardError("One or more course media files could not be included. Check that they still belong to this course.", 409);
    const embeddedAssets = new Map<string, string>();
    await Promise.all(media.map(async (asset) => {
      const readUrl = await createMediaReadUrl({ objectKey: asset.objectKey, contentType: asset.mimeType });
      const response = await fetch(readUrl);
      if (!response.ok) throw new DashboardError(`Could not include media file ${asset.originalName} in the HTML5 package.`, 502);
      const bytes = Buffer.from(await response.arrayBuffer());
      embeddedAssets.set(String(asset._id), `data:${asset.mimeType};base64,${bytes.toString("base64")}`);
    }));
    const authorName = await getCourseAuthorName(ownerId, parsed.data.courseId);
    const courseData = replaceAssetSources({ ...course, authorName }, embeddedAssets);
    const js = await readFile(join(exportDir, "assets", jsName), "utf8");
    const css = await readFile(join(exportDir, "assets", cssName), "utf8");
    const safeJson = JSON.stringify(courseData).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${course.description.replace(/[&<>"']/g, " ").slice(0, 300)}"><title>${course.title.replace(/[&<>"']/g, " ")}</title><style>${css}</style></head><body><div id="export-root"></div><script>window.COURSE_EXPORT_DATA=${safeJson}</script><script>${js}</script></body></html>`;
    const filename = `${course.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "course"}.html`;
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "private, no-store" } });
  } catch (error) {
    return dashboardErrorResponse(error);
  }
}
