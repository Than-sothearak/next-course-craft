import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unzipSync, strFromU8 } from "fflate";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Asset } from "@/models/Asset";
import { LocalStorageProvider } from "@/lib/media/providers/local";
import { buildScorm12Package, buildScorm2004Package } from "@/lib/scorm/package";
import { getCourseEditor } from "@/lib/editor/services/course";

vi.mock("@/lib/editor/services/course", () => ({ getCourseEditor: vi.fn() }));
vi.mock("@/lib/media/storage", () => ({ createMediaReadUrl: vi.fn(async ({ objectKey }) => `https://s3.example/${objectKey}`) }));
vi.mock("node:fs/promises", async (original) => {
  const fs = await original<typeof import("node:fs/promises")>();
  return { ...fs,
    readdir: vi.fn(async (...args: Parameters<typeof fs.readdir>) => String(args[0]).endsWith("course-export/assets")
      ? ["export.js", "export.css"].map((name) => ({ name, isDirectory: () => false, isFile: () => true }))
      : fs.readdir(...args)),
    readFile: vi.fn(async (...args: Parameters<typeof fs.readFile>) => /course-export\/assets\/export\.(js|css)$/.test(String(args[0]))
      ? Buffer.from(String(args[0]).endsWith(".js") ? "window.offlineCourse=true;" : "body{margin:0}")
      : fs.readFile(...args)),
  };
});

const ownerId = "507f1f77bcf86cd799439011";
const courseId = "507f1f77bcf86cd799439012";
const ids = ["507f1f77bcf86cd799439013", "507f1f77bcf86cd799439014", "507f1f77bcf86cd799439015"];
const assets = ids.map((id, index) => ({ _id: id, ownerId, courseId, size: 8, storageDirectory: undefined as string | undefined, mimeType: "image/png", originalName: `image-${index}.png`, objectKey: `owner/course/${id}`, ...(index === 0 ? {} : { storageProvider: index === 1 ? "local" : "s3", storageKey: `owner/course/${id}` }) }));
let directory: string;
beforeEach(async () => {
  directory = await realpath(await mkdtemp(join(tmpdir(), "coursecraft-export-")));
  vi.stubEnv("MEDIA_LOCAL_DIRECTORY", join(directory, "different-active-folder"));
  assets[1].storageDirectory = directory;
  await new LocalStorageProvider(directory).upload({ key: assets[1].objectKey, contentType: "image/png", size: 8, assetId: ids[1], body: Buffer.from("localpng") });
  vi.spyOn(Asset, "find").mockReturnValue({ lean: async () => assets } as never);
  vi.mocked(getCourseEditor).mockResolvedValue({
    courseId, title: "Offline course", description: "Mixed storage", revision: 3,
    sections: [{ id: "s", title: "Learn", order: 0 }],
    lessons: [{ id: "l", sectionId: "s", title: "Images", order: 0, blocks: ids.map((id) => ({ id, version: 1, type: "image", data: { src: `/api/assets/${id}/file`, alt: "Media" } })) }],
  } as Awaited<ReturnType<typeof getCourseEditor>>);
  vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(url.endsWith(ids[0]) ? "legacypn" : "s3newpng")));
});
afterEach(async () => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); await rm(directory, { recursive: true, force: true }); });

describe("offline packages across storage providers", () => {
  it.each(["1.2", "2004"])("packages local, explicit S3 and legacy S3 assets in SCORM %s", async (version) => {
    const build = version === "1.2" ? buildScorm12Package : buildScorm2004Package;
    const { archive } = await build({ ownerId, courseId, authorName: "Author" });
    const files = unzipSync(new Uint8Array(archive));
    expect(strFromU8(files[`media/${ids[0]}.png`])).toBe("legacypn");
    expect(strFromU8(files[`media/${ids[1]}.png`])).toBe("localpng");
    expect(strFromU8(files[`media/${ids[2]}.png`])).toBe("s3newpng");
    const html = strFromU8(files["index.html"]);
    expect(html).not.toContain("/api/assets/");
    expect(html).not.toContain("s3.example");
    ids.forEach((id) => expect(html).toContain(`./media/${id}.png`));
    expect(html).toContain(`"scorm12Enabled":${version === "1.2"}`);
    expect(html).toContain(`"scorm2004Enabled":${version === "2004"}`);
    expect(strFromU8(files["imsmanifest.xml"])).toContain(`media/${ids[1]}.png`);
    expect(Asset.find).toHaveBeenCalledWith({ _id: { $in: ids }, ownerId, courseId, status: "ready" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it.each(["1.2", "2004"])("packages lesson audio for offline playback in SCORM %s", async (version) => {
    const audio = { ...assets[0], mimeType: "audio/mpeg", originalName: "Introduction.mp3" };
    vi.mocked(Asset.find).mockReturnValue({ lean: async () => [audio] } as never);
    const course = await getCourseEditor(ownerId, courseId);
    course.lessons[0].blocks = [{
      id: "audio", version: 1, type: "audio", width: "medium", widthCustom: false,
      blockPadding: 40, backgroundColor: "#ffffff",
      data: { src: `/api/assets/${ids[0]}/file`, fileName: audio.originalName, mimeType: "audio/mpeg" },
    }];
    vi.mocked(fetch).mockResolvedValue(new Response("ID3audio"));
    const build = version === "1.2" ? buildScorm12Package : buildScorm2004Package;
    const { archive } = await build({ ownerId, courseId, authorName: "Author" });
    const files = unzipSync(new Uint8Array(archive));
    expect(strFromU8(files[`media/${ids[0]}.mp3`])).toBe("ID3audio");
    expect(strFromU8(files["index.html"])).toContain(`./media/${ids[0]}.mp3`);
    expect(strFromU8(files["index.html"])).not.toContain("/api/assets/");
    expect(strFromU8(files["imsmanifest.xml"])).toContain(`media/${ids[0]}.mp3`);
  });
  it("refuses to export unavailable or foreign media", async () => {
    vi.mocked(Asset.find).mockReturnValue({ lean: async () => assets.slice(0, 2) } as never);
    await expect(buildScorm12Package({ ownerId, courseId, authorName: "Author" })).rejects.toMatchObject({ status: 409 });
    expect(fetch).not.toHaveBeenCalled();
  });
});
