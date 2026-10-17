import { readFile, readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { Asset } from "@/models/Asset";
import { getCourseEditor } from "@/lib/editor/services/course";
import { DashboardError } from "@/lib/dashboard/rules";
import { createMediaReadUrl } from "@/lib/media/storage";
import { createScorm12Manifest } from "../scorm12/manifest";
import { createScorm2004Manifest } from "./manifest-2004";
import { parseScorm12Snapshot } from "../scorm12/snapshot";
import { createZipArchive, type ZipFile } from "../scorm12/zip";

const assetUrlPattern = /\/api\/assets\/([\da-f]{24})\/file\b/gi;
const MAX_MEDIA_BYTES = 200 * 1024 * 1024;
const MAX_MEDIA_FILES = 2_000;

const extensionsByMimeType: Record<string, string> = {
  "image/avif": "avif",
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/svg+xml": "svg",
  "image/webp": "webp",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/webm": "weba",
  "video/mp4": "mp4",
  "video/ogg": "ogv",
  "video/webm": "webm",
  "text/vtt": "vtt",
  "application/pdf": "pdf",
};

async function listFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) return listFiles(absolutePath);
    if (entry.isFile()) return [absolutePath];
    return [];
  }));
  return nested.flat();
}

function replaceAssetSources(value: unknown, sources: Map<string, string>): unknown {
  if (typeof value === "string") {
    return value.replace(assetUrlPattern, (match, assetId: string) => sources.get(assetId) ?? match);
  }
  if (Array.isArray(value)) return value.map((item) => replaceAssetSources(item, sources));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceAssetSources(item, sources)]));
  }
  return value;
}

function scriptSafeJson(value: unknown) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function htmlEscape(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);
}

function safeFilename(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "course";
}

async function buildScormPackage({
  ownerId,
  courseId,
  authorName,
  version,
}: {
  ownerId: string;
  courseId: string;
  authorName: string;
  version: "1.2" | "2004";
}) {
  const editorCourse = await getCourseEditor(ownerId, courseId);
  if (editorCourse.editorType === "slide")
    throw new DashboardError("Slide course SCORM publishing is not available yet.", 409);
  const { courseId: snapshotCourseId, ...untrustedSnapshot } = editorCourse;
  const course = parseScorm12Snapshot(untrustedSnapshot);

  const serialized = JSON.stringify(course);
  const assetIds = new Set([...serialized.matchAll(assetUrlPattern)].map((match) => match[1].toLowerCase()));
  if (assetIds.size > MAX_MEDIA_FILES) {
    throw new DashboardError("This SCORM package exceeds the 2,000 media file limit. Remove some media and try again.", 413);
  }
  const assets = assetIds.size
    ? await Asset.find({
        _id: { $in: [...assetIds] },
        ownerId,
        courseId,
        status: "ready",
      }).lean()
    : [];
  if (assets.length !== assetIds.size) {
    throw new DashboardError("One or more course media files could not be included. Check that they still belong to this course.", 409);
  }
  const estimatedMediaBytes = assets.reduce((total, asset) => total + asset.size, 0);
  if (estimatedMediaBytes > MAX_MEDIA_BYTES) {
    throw new DashboardError("This SCORM package exceeds the 200 MB media limit. Remove some media and try again.", 413);
  }

  const mediaFiles: ZipFile[] = [];
  const mediaSources = new Map<string, string>();
  for (let offset = 0; offset < assets.length; offset += 8) {
    const batch = await Promise.all(assets.slice(offset, offset + 8).map(async (asset) => {
      const mimeType = asset.mimeType.split(";")[0].trim().toLowerCase();
      const extension = extensionsByMimeType[mimeType];
      if (!extension) {
        throw new DashboardError(`Media type ${mimeType || "unknown"} is not supported in offline SCORM packages.`, 422);
      }
      const assetId = String(asset._id).toLowerCase();
      const path = `media/${assetId}.${extension}`;
      const readUrl = await createMediaReadUrl({ objectKey: asset.objectKey, contentType: asset.mimeType });
      let response: Response;
      try {
        response = await fetch(readUrl);
      } catch {
        throw new DashboardError(`Could not include media file ${asset.originalName} in the SCORM package.`, 502);
      }
      if (!response.ok) {
        throw new DashboardError(`Could not include media file ${asset.originalName} in the SCORM package.`, 502);
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length !== asset.size) {
        throw new DashboardError(`Media file ${asset.originalName} changed while it was being exported.`, 409);
      }
      return { assetId, path, bytes };
    }));
    for (const { assetId, path, bytes } of batch) {
      mediaFiles.push({ path, data: bytes });
      mediaSources.set(assetId, `./${path}`);
    }
  }

  const exportDir = join(process.cwd(), "public", "course-export");
  const assetsDir = join(exportDir, "assets");
  let exportFiles: string[];
  try {
    exportFiles = await listFiles(assetsDir);
  } catch {
    throw new DashboardError("Build the course export before publishing (npm run build:export).", 503);
  }
  const jsFile = exportFiles.find((file) => file.endsWith(".js"));
  const cssFile = exportFiles.find((file) => file.endsWith(".css"));
  if (!jsFile || !cssFile) {
    throw new DashboardError("The course export build is incomplete. Rebuild it before publishing.", 503);
  }

  const relativeExportFiles = exportFiles.map((file) => ({
    path: relative(exportDir, file).split(sep).join("/"),
    data: readFile(file),
  }));
  const exportBundle = await Promise.all(relativeExportFiles.map(async ({ path, data }) => ({ path, data: await data })));
  const courseData = replaceAssetSources({
    courseId: snapshotCourseId,
    ...course,
    authorName: course.authorVisible ? authorName : "Course author",
    scorm12Enabled: version === "1.2",
    scorm2004Enabled: version === "2004",
  }, mediaSources);
  const jsPath = relative(exportDir, jsFile).split(sep).join("/");
  const cssPath = relative(exportDir, cssFile).split(sep).join("/");
  const index = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${htmlEscape(course.title)}</title>
  <link rel="stylesheet" href="./${cssPath}">
</head>
<body>
  <div id="export-root"></div>
  <script>window.COURSE_EXPORT_DATA=${scriptSafeJson(courseData)}</script>
  <script type="module" src="./${jsPath}"></script>
</body>
</html>`;
  const schemaFiles: ZipFile[] = version === "1.2"
    ? await Promise.all(
      ["imscp_rootv1p1p2.xsd", "imsmd_rootv1p2p1.xsd", "adlcp_rootv1p2.xsd", "ims_xml.xsd"].map(async (name) => ({
        path: name,
        data: await readFile(join(process.cwd(), "public", "scorm12", "schema", name)),
      })),
    )
    : await Promise.all(
      ["imscp_v1p1.xsd", "adlcp_v1p3.xsd", "xml.xsd"].map(async (name) => ({
        path: `SCORM-schemas/${name}`,
        data: await readFile(join(process.cwd(), "public", "scorm2004", "schema", name)),
      })),
    );
  const files: ZipFile[] = [
    { path: "index.html", data: index },
    ...exportBundle,
    ...schemaFiles,
    ...mediaFiles,
  ];
  const manifestInput = {
    identifier: `course-${snapshotCourseId}-r${course.revision}`,
    title: course.title,
    files,
  };
  const manifest = version === "1.2"
    ? createScorm12Manifest(manifestInput)
    : createScorm2004Manifest(manifestInput);
  return {
    filename: `${safeFilename(course.title)}.zip`,
    archive: createZipArchive([
      { path: "imsmanifest.xml", data: manifest },
      ...files,
    ]),
  };
}

export function buildScorm12Package(input: { ownerId: string; courseId: string; authorName: string }) {
  return buildScormPackage({ ...input, version: "1.2" });
}

export function buildScorm2004Package(input: { ownerId: string; courseId: string; authorName: string }) {
  return buildScormPackage({ ...input, version: "2004" });
}
