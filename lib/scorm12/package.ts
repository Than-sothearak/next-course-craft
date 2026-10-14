import { readFile, readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { Asset } from "@/models/Asset";
import { getCourseEditor } from "@/lib/editor/services/course";
import { DashboardError } from "@/lib/dashboard/rules";
import { createMediaReadUrl } from "@/lib/media/storage";
import { createScorm12Manifest } from "./manifest";
import { parseScorm12Snapshot } from "./snapshot";
import { createZipArchive, type ZipFile } from "./zip";

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

export async function buildScorm12Package({
  ownerId,
  courseId,
  authorName,
}: {
  ownerId: string;
  courseId: string;
  authorName: string;
}) {
  const editorCourse = await getCourseEditor(ownerId, courseId);
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

  const playerDir = join(process.cwd(), "public", "course-player");
  const assetsDir = join(playerDir, "assets");
  let playerFiles: string[];
  try {
    playerFiles = await listFiles(assetsDir);
  } catch {
    throw new DashboardError("Build the standalone player before publishing (npm run build:player).", 503);
  }
  const jsFile = playerFiles.find((file) => file.endsWith(".js"));
  const cssFile = playerFiles.find((file) => file.endsWith(".css"));
  if (!jsFile || !cssFile) {
    throw new DashboardError("The standalone player build is incomplete. Rebuild it before publishing.", 503);
  }

  const relativePlayerFiles = playerFiles.map((file) => ({
    path: relative(playerDir, file).split(sep).join("/"),
    data: readFile(file),
  }));
  const playerBundle = await Promise.all(relativePlayerFiles.map(async ({ path, data }) => ({ path, data: await data })));
  const courseData = replaceAssetSources({
    courseId: snapshotCourseId,
    ...course,
    authorName: course.authorVisible ? authorName : "Course author",
    scorm12Enabled: true,
  }, mediaSources);
  const jsPath = relative(playerDir, jsFile).split(sep).join("/");
  const cssPath = relative(playerDir, cssFile).split(sep).join("/");
  const index = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${htmlEscape(course.title)}</title>
  <link rel="stylesheet" href="./${cssPath}">
</head>
<body>
  <div id="player-root"></div>
  <script>window.COURSE_PLAYER_DATA=${scriptSafeJson(courseData)}</script>
  <script type="module" src="./${jsPath}"></script>
</body>
</html>`;
  const files: ZipFile[] = [
    { path: "index.html", data: index },
    ...playerBundle,
    ...await Promise.all(
      ["imscp_rootv1p1p2.xsd", "imsmd_rootv1p2p1.xsd", "adlcp_rootv1p2.xsd", "ims_xml.xsd"].map(async (name) => ({
        path: name,
        data: await readFile(join(process.cwd(), "public", "scorm12", "schema", name)),
      })),
    ),
    ...mediaFiles,
  ];
  const manifest = createScorm12Manifest({
    identifier: `course-${snapshotCourseId}-r${course.revision}`,
    title: course.title,
    files,
  });
  return {
    filename: `${safeFilename(course.title)}.zip`,
    archive: createZipArchive([
      { path: "imsmanifest.xml", data: manifest },
      ...files,
    ]),
  };
}
