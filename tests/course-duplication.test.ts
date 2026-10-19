import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import { Asset, Course, Lesson } from "../models";
import { duplicateCourse } from "../lib/dashboard/services/courses";
import { getCourseEditor } from "../lib/editor/services/course";
import { editorSnapshotSchema } from "../lib/editor/schemas";
import { copyMediaObject, deleteMediaObject } from "../lib/media/storage";
import { activeStorageConfiguration } from "../lib/media/service";
import { LocalStorageProvider } from "../lib/media/providers/local";
import { S3StorageProvider } from "../lib/media/providers/s3";
import { courseAssetIds } from "../lib/media/asset-references";
import { parseScorm12Snapshot } from "../lib/scorm12/snapshot";

vi.mock("../lib/media/service", async (original) => ({ ...await original<typeof import("../lib/media/service")>(), activeStorageConfiguration: vi.fn(async () => ({ provider: "s3" })) }));

vi.mock("../lib/editor/services/course", () => ({ getCourseEditor: vi.fn() }));
vi.mock("../lib/media/storage", () => ({ copyMediaObject: vi.fn(), deleteMediaObject: vi.fn() }));

const ownerId = "507f1f77bcf86cd799439011";
const courseId = "507f1f77bcf86cd799439012";
const imageId = "507f1f77bcf86cd799439013";
const videoId = "507f1f77bcf86cd799439014";
const unusedId = "507f1f77bcf86cd799439015";
const destinationOwnerId = "507f1f77bcf86cd799439016";
const destinationWorkspaceId = "507f1f77bcf86cd799439017";
const destinationCreatorId = "507f1f77bcf86cd799439018";
const imageUrl = `/api/assets/${imageId}/file`;
const videoUrl = `/api/assets/${videoId}/file`;

function fixture() {
  const snapshot = editorSnapshotSchema.parse({
    title: "Images course", description: "Course with images", descriptionHtml: `<p><img src="${imageUrl}"></p>`,
    revision: 4, navigationMode: "free", authorVisible: false,
    theme: { cover: { template: "image", imageSrc: imageUrl, imageAlt: "Course cover" } },
    sections: [{ id: "learn", title: "Learn", order: 0 }, { id: "post", title: "Post activities", order: 1 }],
    lessons: [
      { id: "lesson-1", sectionId: "learn", title: "Images", titleHtml: "<p><strong>Images</strong></p>", order: 0, blocks: [
        { id: "text", version: 1, type: "richText", data: { html: `<p>Explanation</p><img src="${imageUrl}">` } },
        { id: "image", version: 1, type: "image", data: { src: imageUrl, alt: "Original" } },
        { id: "gallery", version: 1, type: "gallery", data: { images: [{ src: imageUrl, alt: "Gallery" }, { src: "https://example.com/external.png", alt: "External" }] } },
        { id: "flip", version: 1, type: "flipCard", data: { cards: [{ id: "card", frontLabel: "Front", backLabel: "Back", front: { type: "image", src: imageUrl, alt: "Front image" }, back: { type: "image", src: imageUrl, alt: "Back image" } }] } },
        { id: "graphic", version: 1, type: "labeledGraphic", data: { src: imageUrl, alt: "Diagram", markers: [{ id: "marker", label: "Part", description: "Description", x: 50, y: 50 }] } },
        { id: "video", version: 1, type: "video", data: { src: videoUrl, mimeType: "video/mp4" } },
      ] },
      { id: "quiz", sectionId: "post", title: "Quiz", lessonType: "quiz", passingScore: 80, order: 0, blocks: [], quizQuestions: [{
        id: "question", prompt: "Which image?", imageSrc: imageUrl,
        choices: [{ id: "right", text: "Right", imageSrc: imageUrl }, { id: "wrong", text: "Wrong" }], correctChoiceIds: ["right"],
      }] },
    ],
  });
  const source = new Course({ _id: courseId, ownerId, ...snapshot, coverImage: imageUrl, language: "km", completionSettings: { required: true } }).toObject();
  const assets = [
    [imageId, "photo.png", "image/png"], [videoId, "video.mp4", "video/mp4"], [unusedId, "unused.gif", "image/gif"],
  ].map(([id, originalName, mimeType]) => new Asset({
    _id: id, ownerId, courseId, originalName, mimeType, size: 100,
    objectKey: `${ownerId}/${courseId}/${id}`, status: "ready", checksum: "checksum", metadata: { alt: "Source media" },
  }).toObject());
  return { snapshot, source, assets };
}

describe("course duplication with independent media", () => {
  let data: ReturnType<typeof fixture>;
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(activeStorageConfiguration).mockResolvedValue({ provider: "s3" });
    data = fixture();
    vi.spyOn(Course, "findOne").mockReturnValue({ lean: async () => data.source } as never);
    vi.spyOn(Course, "exists").mockResolvedValue({ _id: data.source._id });
    vi.mocked(getCourseEditor).mockImplementation(async () => ({ ...data.snapshot, courseId }) as Awaited<ReturnType<typeof getCourseEditor>>);
    vi.spyOn(Asset, "find").mockReturnValue({ lean: async () => data.assets } as never);
    vi.spyOn(Asset, "create").mockImplementation((async (value: unknown) => value) as never);
    vi.spyOn(Lesson, "insertMany").mockResolvedValue([] as never);
    vi.spyOn(Course, "create").mockImplementation((async (value: unknown) => new Course(value)) as never);
    vi.spyOn(Course, "deleteOne").mockResolvedValue({ acknowledged: true, deletedCount: 1 });
    vi.spyOn(Lesson, "deleteMany").mockResolvedValue({ acknowledged: true, deletedCount: 2 });
    vi.spyOn(Asset, "deleteMany").mockResolvedValue({ acknowledged: true, deletedCount: 3 });
    vi.mocked(copyMediaObject).mockResolvedValue(undefined);
    vi.mocked(deleteMediaObject).mockResolvedValue(undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  it.each(["local", "s3"] as const)("copies mixed source providers to the selected %s provider", async (target) => {
    data.assets[0].storageProvider = "local";
    data.assets[0].storageKey = "original/local/key";
    vi.mocked(activeStorageConfiguration).mockResolvedValue({ provider: target, ...(target === "local" ? { directory: "/data/coursecraft/chosen-folder" } : {}) });
    const localRead = vi.spyOn(LocalStorageProvider.prototype, "read").mockImplementation(async () => new Response(new Uint8Array(100)));
    vi.spyOn(S3StorageProvider.prototype, "read").mockImplementation(async () => new Response(new Uint8Array(100)));
    const localUpload = vi.spyOn(LocalStorageProvider.prototype, "upload").mockResolvedValue();
    const s3Upload = vi.spyOn(S3StorageProvider.prototype, "upload").mockResolvedValue();
    await duplicateCourse(ownerId, courseId);
    expect(localRead).toHaveBeenCalledWith(expect.objectContaining({ key: "original/local/key" }), undefined);
    const created = vi.mocked(Asset.create).mock.calls.map(([value]) => value as unknown as Record<string, unknown>);
    expect(created.every((asset) => asset.storageProvider === target && asset.storageKey === asset.objectKey)).toBe(true);
    if (target === "local") {
      expect(created.every((asset) => asset.storageDirectory === "/data/coursecraft/chosen-folder")).toBe(true);
      expect(localUpload).toHaveBeenCalledTimes(3);
      expect(copyMediaObject).not.toHaveBeenCalled();
    } else {
      expect(s3Upload).toHaveBeenCalledOnce();
      expect(copyMediaObject).toHaveBeenCalledTimes(2);
    }
  });

  it("cleans failed local copies through their destination provider without deleting source keys", async () => {
    vi.mocked(activeStorageConfiguration).mockResolvedValue({ provider: "local" });
    vi.spyOn(S3StorageProvider.prototype, "read").mockImplementation(async () => new Response(new Uint8Array(100)));
    vi.spyOn(LocalStorageProvider.prototype, "upload").mockResolvedValue();
    const remove = vi.spyOn(LocalStorageProvider.prototype, "delete").mockResolvedValue();
    vi.mocked(Course.create).mockRejectedValueOnce(new Error("Course write failed"));
    await expect(duplicateCourse(ownerId, courseId)).rejects.toThrow("Course write failed");
    expect(remove).toHaveBeenCalledTimes(3);
    for (const [key] of remove.mock.calls) expect(data.assets.map((asset) => asset.objectKey)).not.toContain(key);
    expect(deleteMediaObject).not.toHaveBeenCalled();
  });

  it("copies all lessons and ready media, remapping every image location and both covers", async () => {
    const before = JSON.stringify(data);
    const result = await duplicateCourse(ownerId, courseId);
    const copy = vi.mocked(Course.create).mock.calls[0][0] as unknown as Record<string, unknown>;
    const lessons = vi.mocked(Lesson.insertMany).mock.calls[0][0] as unknown as Array<Record<string, unknown>>;
    const assets = vi.mocked(Asset.create).mock.calls.map(([asset]) => asset as unknown as Record<string, unknown>);
    expect(result).toMatchObject({ title: "Images course (copy)", status: "draft" });
    expect(result.id).not.toBe(courseId);
    expect(Course.findOne).toHaveBeenCalledWith({ _id: courseId, ownerId: new Types.ObjectId(ownerId), deletedAt: null, editorSaveLock: null });
    expect(Asset.find).toHaveBeenCalledWith({ ownerId: new Types.ObjectId(ownerId), status: "ready", $or: [{ courseId: data.source._id }, { _id: { $in: [imageId, videoId] } }] });
    expect(assets).toHaveLength(3);
    expect(copyMediaObject).toHaveBeenCalledTimes(3);
    assets.forEach((asset, index) => {
      expect(asset.courseId?.toString()).toBe(result.id);
      expect(asset._id?.toString()).not.toBe(data.assets[index]._id.toString());
      expect(asset).toMatchObject({ status: "ready", size: 100, checksum: "checksum", metadata: { alt: "Source media" } });
      expect(copyMediaObject).toHaveBeenNthCalledWith(index + 1, {
        sourceKey: data.assets[index].objectKey, objectKey: asset.objectKey, assetId: asset._id?.toString(), contentType: data.assets[index].mimeType,
      });
      expect(asset.objectKey).toBe(`${ownerId}/${result.id}/${asset._id}`);
    });
    const newImage = `/api/assets/${assets[0]._id}/file`;
    expect(copy.coverImage).toBe(newImage);
    expect(copy.theme).toMatchObject({ cover: { imageSrc: newImage, imageAlt: "Course cover" } });
    expect(copy).toMatchObject({ sections: data.snapshot.sections, language: "km", navigationMode: "free", authorVisible: false, revision: 0, completionSettings: { required: true } });
    expect(lessons).toHaveLength(2);
    expect(lessons.map((lesson) => lesson.title)).toEqual(["Images", "Quiz"]);
    expect(lessons.map((lesson) => lesson.courseId?.toString())).toEqual([result.id, result.id]);
    expect(lessons[1]).toMatchObject({ sectionId: "post", passingScore: 80, quizQuestions: [{ correctChoiceIds: ["right"], choices: [{ id: "right", imageSrc: newImage }, { id: "wrong" }], imageSrc: newImage }] });
    const copiedContent = { ...copy, lessons: lessons.map(({ editorId, ...lesson }) => ({ ...lesson, id: editorId })) };
    expect([...courseAssetIds(copiedContent)].sort()).toEqual(assets.slice(0, 2).map((asset) => asset._id!.toString()).sort());
    expect(JSON.stringify(copiedContent)).toContain("https://example.com/external.png");
    expect(JSON.stringify(copiedContent)).not.toContain(imageId);
    expect(JSON.stringify(copiedContent)).not.toContain(videoId);
    expect(parseScorm12Snapshot(copiedContent).lessons).toHaveLength(2);
    expect(JSON.stringify(data)).toBe(before);
    expect(deleteMediaObject).not.toHaveBeenCalled();
    expect(vi.mocked(Course.create).mock.invocationCallOrder[0]).toBeGreaterThan(vi.mocked(Lesson.insertMany).mock.invocationCallOrder[0]);
  });

  it("duplicates an empty course without calling storage", async () => {
    data.snapshot.lessons = [];
    data.snapshot.descriptionHtml = "";
    delete data.snapshot.theme.cover;
    data.source.coverImage = null;
    data.assets = [];
    await expect(duplicateCourse(ownerId, courseId)).resolves.toMatchObject({ title: "Images course (copy)" });
    expect(copyMediaObject).not.toHaveBeenCalled();
    expect(Lesson.insertMany).not.toHaveBeenCalled();
  });

  it("loads the copied lessons and cover through the existing editor reader", async () => {
    const result = await duplicateCourse(ownerId, courseId);
    const copiedCourse = new Course(vi.mocked(Course.create).mock.calls[0][0]).toObject();
    const copiedLessons = vi.mocked(Lesson.insertMany).mock.calls[0][0];
    vi.mocked(Course.findOne).mockReturnValue({ lean: async () => copiedCourse } as never);
    vi.spyOn(Lesson, "find").mockReturnValue({ sort: () => ({ lean: async () => copiedLessons }) } as never);
    const actual = await vi.importActual<typeof import("../lib/editor/services/course")>("../lib/editor/services/course");
    const loaded = await actual.getCourseEditor(ownerId, result.id);
    expect(loaded.lessons).toHaveLength(2);
    expect(loaded.sections.map((section) => section.title)).toEqual(["Learn", "Post activities"]);
    expect(loaded.theme.cover?.imageSrc).not.toBe(imageUrl);
    expect(courseAssetIds(loaded).has(imageId)).toBe(false);
    expect(parseScorm12Snapshot(loaded).lessons).toHaveLength(2);
  });

  it("makes independent copies of referenced media from an older same-owner course copy", async () => {
    data.assets[0].courseId = new Types.ObjectId("507f1f77bcf86cd799439099");
    const result = await duplicateCourse(ownerId, courseId);
    const asset = vi.mocked(Asset.create).mock.calls[0][0] as unknown as { courseId: Types.ObjectId; objectKey: string };
    expect(asset.courseId.toString()).toBe(result.id);
    expect(asset.objectKey).not.toBe(data.assets[0].objectKey);
    expect(Course.create).toHaveBeenCalledWith(expect.objectContaining({ coverImage: expect.not.stringContaining(imageId) }));
  });

  it("preserves an external dashboard cover without copying its URL to private storage", async () => {
    data.source.coverImage = "https://example.com/cover.png";
    await duplicateCourse(ownerId, courseId);
    expect(Course.create).toHaveBeenCalledWith(expect.objectContaining({ coverImage: "https://example.com/cover.png" }));
    expect(copyMediaObject).toHaveBeenCalledTimes(3);
  });

  it("copies a personal course into a workspace with destination-owned media", async () => {
    await duplicateCourse(ownerId, courseId, { ownerId: destinationOwnerId, workspaceId: destinationWorkspaceId, createdBy: destinationCreatorId });
    const copy = vi.mocked(Course.create).mock.calls[0][0] as unknown as Record<string, unknown>;
    const assets = vi.mocked(Asset.create).mock.calls.map(([asset]) => asset as unknown as Record<string, unknown>);
    expect((copy.ownerId as Types.ObjectId).toString()).toBe(destinationOwnerId);
    expect((copy.createdBy as Types.ObjectId).toString()).toBe(destinationCreatorId);
    expect(copy).toMatchObject({ workspaceId: destinationWorkspaceId, folderId: null });
    expect(Asset.find).toHaveBeenCalledWith(expect.objectContaining({ ownerId: new Types.ObjectId(ownerId) }));
    expect(assets[0].ownerId).toEqual(new Types.ObjectId(destinationOwnerId));
    expect(assets[0].objectKey).toMatch(new RegExp(`^${destinationOwnerId}/`));
  });

  it("rejects inaccessible courses without copying media or content", async () => {
    vi.mocked(Course.findOne).mockReturnValue({ lean: async () => null } as never);
    vi.mocked(Course.exists).mockResolvedValue(null);
    await expect(duplicateCourse(ownerId, courseId)).rejects.toMatchObject({ status: 404 });
    expect(getCourseEditor).not.toHaveBeenCalled();
    expect(Asset.find).not.toHaveBeenCalled();
    expect(Course.create).not.toHaveBeenCalled();
    expect(copyMediaObject).not.toHaveBeenCalled();
  });

  it("rejects source courses currently being saved", async () => {
    vi.mocked(Course.findOne).mockReturnValue({ lean: async () => null } as never);
    await expect(duplicateCourse(ownerId, courseId)).rejects.toMatchObject({ status: 409 });
    expect(copyMediaObject).not.toHaveBeenCalled();
  });

  it.each(["missing media", "changed revision", "invalid content"])("rejects %s before writing any copy", async (failure) => {
    if (failure === "missing media") data.assets = data.assets.slice(1);
    if (failure === "changed revision") vi.mocked(Course.exists).mockResolvedValue(null);
    if (failure === "invalid content") data.snapshot.sections = [];
    await expect(duplicateCourse(ownerId, courseId)).rejects.toMatchObject({ status: failure === "invalid content" ? 422 : 409 });
    expect(copyMediaObject).not.toHaveBeenCalled();
    expect(Asset.create).not.toHaveBeenCalled();
    expect(Lesson.insertMany).not.toHaveBeenCalled();
    expect(Course.create).not.toHaveBeenCalled();
  });

  it.each(["storage", "asset record", "lessons", "course record"])("removes only new records and objects after a failure writing %s", async (failure) => {
    const error = new Error("Write failed");
    if (failure === "storage") vi.mocked(copyMediaObject).mockResolvedValueOnce(undefined).mockRejectedValueOnce(error);
    if (failure === "asset record") vi.mocked(Asset.create).mockRejectedValueOnce(error);
    if (failure === "lessons") vi.mocked(Lesson.insertMany).mockRejectedValueOnce(error);
    if (failure === "course record") vi.mocked(Course.create).mockRejectedValueOnce(error);
    await expect(duplicateCourse(ownerId, courseId)).rejects.toThrow(failure === "storage" ? "Could not copy media file" : "Write failed");
    const copyId = (vi.mocked(Course.deleteOne).mock.calls[0][0] as { _id: Types.ObjectId })._id;
    expect(copyId?.toString()).not.toBe(courseId);
    expect(Course.deleteOne).toHaveBeenCalledWith({ _id: copyId, ownerId: new Types.ObjectId(ownerId) });
    expect(Asset.deleteMany).toHaveBeenCalledWith({ courseId: copyId, ownerId: new Types.ObjectId(ownerId) });
    expect(Lesson.deleteMany).toHaveBeenCalledWith({ courseId: copyId });
    const keys = vi.mocked(copyMediaObject).mock.calls.map(([request]) => request.objectKey);
    expect(vi.mocked(deleteMediaObject).mock.calls.map(([key]) => key)).toEqual(keys);
    expect(keys.every((key) => key.startsWith(`${ownerId}/${copyId}/`))).toBe(true);
    expect(keys.every((key) => !data.assets.some((asset) => asset.objectKey === key))).toBe(true);
  });

  it("continues other cleanup operations if one cleanup fails and preserves the original error", async () => {
    vi.mocked(Course.create).mockRejectedValueOnce(new Error("Course write failed"));
    vi.mocked(Asset.deleteMany).mockRejectedValueOnce(new Error("Cleanup unavailable"));
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(duplicateCourse(ownerId, courseId)).rejects.toThrow("Course write failed");
    expect(Course.deleteOne).toHaveBeenCalledTimes(1);
    expect(Lesson.deleteMany).toHaveBeenCalledTimes(1);
    expect(deleteMediaObject).toHaveBeenCalledTimes(3);
    expect(log).toHaveBeenCalledWith("Course duplication cleanup failed", expect.objectContaining({ failedOperations: 1 }));
  });
});
