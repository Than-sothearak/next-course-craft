import { NextRequest } from "next/server";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db/mongodb";
import { dashboardErrorResponse, requireOwnerId } from "@/lib/dashboard/http";
import { DashboardError } from "@/lib/dashboard/rules";
import { getCourseEditor } from "@/lib/editor/services/course";
import { Asset } from "@/models/Asset";
import { storedMediaBytes } from "@/lib/media/service";
import { validateQuizAssessments } from "@/lib/interactive/quiz-assessment";
import { inlineLocalFontAssets } from "@/lib/export/inline-font-assets";
import { resolveCourseAccess } from "@/lib/workspaces/access";
import { getCourseAuthorName } from "@/lib/editor/services/course";
import { progressExportResponse } from "@/lib/export/progress-stream";
import { createEmbeddedMediaTable, replaceExportMediaReferences } from "@/lib/export/embedded-media";
import { courseExportFilename } from "@/lib/export/filename";

const paramsSchema = z.object({ courseId: z.string().regex(/^[\da-f]{24}$/i) });
const dataUriPattern = /\/api\/assets\/([\da-f]{24})\/file/g;

export async function POST(request: NextRequest, context: { params: Promise<{ courseId: string }> }) {
  try {
    const userId = await requireOwnerId();
    const parsed = paramsSchema.safeParse(await context.params);
    if (!parsed.success) throw new DashboardError("Course not found.", 404);
    await connectToDatabase();
    const { ownerId } = await resolveCourseAccess(userId, parsed.data.courseId, "courses.export");
    await resolveCourseAccess(userId, parsed.data.courseId, "courses.publish");
    return progressExportResponse(request, async (report, signal) => {
      report({ stage: "Loading presentation", value: 8 });
      const course = await getCourseEditor(ownerId, parsed.data.courseId);
      signal.throwIfAborted();
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
      for (const match of JSON.stringify(course).matchAll(dataUriPattern)) referencedAssetIds.add(match[1]);
      const media = referencedAssetIds.size ? await Asset.find({ _id: { $in: [...referencedAssetIds] }, ownerId, courseId: parsed.data.courseId, status: "ready" }).lean() : [];
      if (media.length !== referencedAssetIds.size) throw new DashboardError("One or more course media files could not be included. Check that they still belong to this course.", 409);
      const embeddedAssets = new Map<string, string>();
      const totalMediaBytes = media.reduce((total, asset) => total + asset.size, 0);
      let completedMediaBytes = 0;
      const batchSize = 8;
      for (let offset = 0; offset < media.length; offset += batchSize) {
        signal.throwIfAborted();
        const batch = await Promise.all(media.slice(offset, offset + batchSize).map(async (asset) => {
          const bytes = await storedMediaBytes(asset, { signal });
          return [String(asset._id), `data:${asset.mimeType};base64,${bytes.toString("base64")}`] as const;
        }));
        batch.forEach(([id, data]) => embeddedAssets.set(id, data));
        completedMediaBytes += media.slice(offset, offset + batchSize).reduce((total, asset) => total + asset.size, 0);
        report({ stage: `Reading media (${Math.min(offset + batch.length, media.length)} of ${media.length} files)`, value: 12 + 52 * completedMediaBytes / Math.max(totalMediaBytes, 1) });
      }
      signal.throwIfAborted();
      report({ stage: "Building standalone HTML", value: 72 });
      const authorName = await getCourseAuthorName(ownerId, parsed.data.courseId);
      const mediaTable = createEmbeddedMediaTable([...embeddedAssets].map(([id, dataUri]) => ({ id, dataUri })));
      const courseData = replaceExportMediaReferences({ ...course, authorName }, mediaTable.references, dataUriPattern);
      const mediaJson = JSON.stringify(mediaTable.media).replace(/</g, "\\u003c");
      const exportAssetsDir = join(exportDir, "assets");
      const [js, cssSource] = await Promise.all([readFile(join(exportAssetsDir, jsName), "utf8"), readFile(join(exportAssetsDir, cssName), "utf8")]);
      const css = await inlineLocalFontAssets(cssSource, exportAssetsDir);
      const safeJson = JSON.stringify(courseData).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
      const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${course.description.replace(/[&<>"']/g, " ").slice(0, 300)}"><title>${course.title.replace(/[&<>"']/g, " ")}</title><style>${css}</style></head><body><div id="export-root"></div><script>window.COURSE_EXPORT_MEDIA=${mediaJson};window.COURSE_EXPORT_DATA=${safeJson}</script><script>${js}</script></body></html>`;
      report({ stage: "Export ready", value: 90 });
      return { data: html, filename: courseExportFilename(course.title, "html") };
    });
  } catch (error) {
    return dashboardErrorResponse(error);
  }
}
