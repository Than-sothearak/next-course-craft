import { randomUUID } from "node:crypto";
import mongoose, { Types } from "mongoose";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Course, Lesson, Asset, User, RolePermission, CourseAssignment, WorkspaceMembership, Workspace } from "@/models";
import { getCourseShare, publishCourseShare, revokeCourseShare, getPublicCourse, getPublicCourseAsset } from "@/lib/publishing/share";
import { GET, POST, DELETE } from "@/app/api/courses/[courseId]/publish/share/route";
import { GET as publicMedia } from "@/app/api/shared-courses/[token]/assets/[assetId]/route";
import { editorLessonSchema } from "@/lib/editor/schemas";

const mocks = vi.hoisted(() => ({ userId: null as string | null, readMedia: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: async () => mocks.userId ? { user: { id: mocks.userId } } : null }));
vi.mock("@/lib/db/mongodb", () => ({ connectToDatabase: async () => mongoose }));
vi.mock("next/server", async (original) => ({ ...await original<typeof import("next/server")>(), connection: async () => undefined }));
vi.mock("@/lib/media/service", () => ({ readStoredMedia: mocks.readMedia }));

const uri = process.env.RBAC_TEST_MONGODB_URI;
const database = `coursecraft_share_test_${randomUUID().replaceAll("-", "")}`;
const models = [Course, Lesson, Asset, User, RolePermission, CourseAssignment, WorkspaceMembership, Workspace];
let ownerId: string;
let courseId: string;
const context = () => ({ params: Promise.resolve({ courseId }) });
const request = (method: string, origin = "http://localhost") => new NextRequest(`http://localhost/api/courses/${courseId}/publish/share`, { method, headers: { origin } });

describe.skipIf(!uri)("public course sharing in MongoDB", () => {
  beforeAll(async () => {
    await mongoose.connect(uri!, { dbName: database });
    await Promise.all(models.map((model) => model.init()));
  }, 30_000);
  afterAll(async () => {
    if (mongoose.connection.name === database) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  beforeEach(async () => {
    vi.clearAllMocks();
    await Promise.all(models.map((model) => mongoose.connection.db!.collection(model.collection.collectionName).deleteMany({})));
    ownerId = String((await User.create({ name: "Course author", email: "author@example.com", role: "editor", status: "active" }))._id);
    courseId = String((await Course.create({ ownerId, title: "Published title", description: "Course description", sections: [{ id: "section", title: "Learn", order: 0 }] }))._id);
    const lesson = editorLessonSchema.parse({ id: "lesson", sectionId: "section", title: "Lesson one", order: 0, blocks: [{ id: "text", version: 1, type: "richText", data: { html: "<p>Published explanation</p>" } }] });
    await Lesson.create({ ...lesson, editorId: lesson.id, courseId });
    mocks.userId = ownerId;
    mocks.readMedia.mockImplementation(async () => new Response(new Uint8Array([1, 2]), { status: 206, headers: { "content-range": "bytes 0-1/4", "accept-ranges": "bytes", "content-length": "2" } }));
  });

  it.each(["standard", "slides"])("publishes a stable %s learner snapshot and keeps subsequent drafts private", async (courseLayout) => {
    await Course.updateOne({ _id: courseId }, { $set: { courseLayout } });
    expect(await getCourseShare(ownerId, courseId)).toBeNull();
    const share = await publishCourseShare(ownerId, courseId);
    const token = share.path.split("/").at(-1)!;
    expect(token).toMatch(/^[a-f\d]{48}$/);
    expect((await Course.findById(courseId).lean())?.publicShare?.snapshot).toBeUndefined();
    mocks.userId = null;
    const published = await getPublicCourse(token);
    expect(published.data).toMatchObject({ title: "Published title", courseLayout });
    expect(published.authorName).toBe("Course author");
    await Course.updateOne({ _id: courseId }, { $set: { title: "Draft title" }, $inc: { revision: 1 } });
    await Lesson.updateOne({ courseId }, { $set: { title: "Draft lesson" } });
    expect((await getPublicCourse(token)).data.title).toBe("Published title");
    expect((await getPublicCourse(token)).data.lessons[0].title).toBe("Lesson one");
    expect((await publishCourseShare(ownerId, courseId)).path).toBe(share.path);
    expect((await getPublicCourse(token)).data.title).toBe("Draft title");
    expect(await getCourseShare(ownerId, courseId)).toMatchObject({ path: share.path });
    await revokeCourseShare(ownerId, courseId);
    await expect(getPublicCourse(token)).rejects.toMatchObject({ status: 404 });
    expect((await Course.findById(courseId).lean())?.status).toBe("draft");
    expect((await publishCourseShare(ownerId, courseId)).path).not.toBe(share.path);
  });

  it("exposes only snapshot media and preserves range streaming without requiring login", async () => {
    const assetId = new Types.ObjectId();
    await Asset.create({ _id: assetId, ownerId, courseId, objectKey: "private/media", originalName: "sample.mp4", mimeType: "video/mp4", size: 4, status: "ready" });
    await Lesson.updateOne({ courseId }, { $set: { blocks: [{ id: "text", type: "richText", version: 1, data: { html: `<p><a href="/api/assets/${assetId}/file">Download</a></p>` } }] } });
    const token = (await publishCourseShare(ownerId, courseId)).path.split("/").at(-1)!;
    mocks.userId = null;
    expect(JSON.stringify((await getPublicCourse(token)).data)).toContain(`/api/shared-courses/${token}/assets/${assetId}`);
    await expect(getPublicCourseAsset(token, String(new Types.ObjectId()))).rejects.toMatchObject({ status: 404 });
    const req = new NextRequest(`http://localhost/api/shared-courses/${token}/assets/${assetId}`, { headers: { range: "bytes=0-1" } });
    const ctx = { params: Promise.resolve({ token, assetId: String(assetId) }) };
    const response = await publicMedia(req, ctx);
    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe("bytes 0-1/4");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.readMedia).toHaveBeenCalledWith(expect.objectContaining({ objectKey: "private/media" }), expect.objectContaining({ range: "bytes=0-1" }));
    await revokeCourseShare(ownerId, courseId);
    expect((await publicMedia(req, ctx)).status).toBe(404);
  });

  it("rejects missing or foreign course media before publishing", async () => {
    const id = new Types.ObjectId();
    await Asset.create({ _id: id, ownerId, courseId: new Types.ObjectId(), objectKey: "foreign/media", originalName: "image.png", mimeType: "image/png", size: 4, status: "ready" });
    await Lesson.updateOne({ courseId }, { $set: { blocks: [{ id: "text", type: "richText", version: 1, data: { html: `<img src="/api/assets/${id}/file">` } }] } });
    await expect(publishCourseShare(ownerId, courseId)).rejects.toMatchObject({ status: 409 });
    expect(await getCourseShare(ownerId, courseId)).toBeNull();
  });

  it("rejects incomplete assessments and empty courses", async () => {
    await Lesson.updateOne({ courseId }, { $set: { lessonType: "quiz", quizQuestions: [] } });
    await expect(publishCourseShare(ownerId, courseId)).rejects.toMatchObject({ status: 422 });
    await Lesson.deleteMany({ courseId });
    await expect(publishCourseShare(ownerId, courseId)).rejects.toMatchObject({ status: 422 });
  });

  it("preserves the existing public snapshot while a draft save is in progress", async () => {
    const share = await publishCourseShare(ownerId, courseId);
    const token = share.path.split("/").at(-1)!;
    await Course.updateOne({ _id: courseId }, { $set: { editorSaveLock: "saving", title: "Unsaved draft" } });
    await expect(publishCourseShare(ownerId, courseId)).rejects.toMatchObject({ status: 409 });
    expect((await getPublicCourse(token)).data.title).toBe("Published title");
  });

  it("blocks shared pages and media after course deletion", async () => {
    const token = (await publishCourseShare(ownerId, courseId)).path.split("/").at(-1)!;
    await Course.updateOne({ _id: courseId }, { $set: { deletedAt: new Date() } });
    await expect(getPublicCourse(token)).rejects.toMatchObject({ status: 404 });
    await expect(getPublicCourseAsset(token, String(new Types.ObjectId()))).rejects.toMatchObject({ status: 404 });
  });

  it("protects management APIs with authentication, origin, ownership and both publishing permissions", async () => {
    const deniedUser = await User.create({ email: "other@example.com", role: "editor", status: "active" });
    mocks.userId = null;
    expect((await POST(request("POST"), context())).status).toBe(401);
    mocks.userId = String(deniedUser._id);
    expect((await GET(request("GET"), context())).status).toBe(404);
    mocks.userId = ownerId;
    expect((await POST(request("POST", "https://other.example"), context())).status).toBe(403);
    for (const permissions of [["courses.view", "courses.publish"], ["courses.view", "courses.export"]]) {
      await User.updateOne({ _id: ownerId }, { $set: { permissions } });
      expect((await POST(request("POST"), context())).status).toBe(403);
      expect((await DELETE(request("DELETE"), context())).status).toBe(403);
    }
    await User.updateOne({ _id: ownerId }, { $unset: { permissions: "" } });
    const response = await POST(request("POST"), context());
    expect(response.status).toBe(200);
    expect((await response.json()).share.path).toMatch(/^\/share\//);
    await User.updateOne({ _id: ownerId }, { $set: { status: "suspended" } });
    expect((await DELETE(request("DELETE"), context())).status).toBe(403);
  });
});
