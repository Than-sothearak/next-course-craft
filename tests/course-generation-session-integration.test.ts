import { randomUUID } from "node:crypto";
import mongoose, { Types } from "mongoose";
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Asset } from "@/models/Asset";
import { prepareOutlineCover } from "@/lib/ai/generation/session-cover";
import { courseCoverSchema } from "@/lib/editor/course-cover";
import { Course } from "@/models/Course";
import { Lesson } from "@/models/Lesson";
import { CourseGenerationSession } from "@/models/CourseGenerationSession";
import { GenerationCheckpoint } from "@/models/GenerationCheckpoint";
import { editorLessonSchema } from "@/lib/editor/schemas";
import { getCourseEditor } from "@/lib/editor/services/course";
import { saveCourseEditor } from "@/lib/editor/services/save";
import { approveSession, cancelSession, commitNextLesson, getSession, planSession, prepareNextLesson } from "@/lib/ai/generation/session-workflow";
import { prepareSessionLesson } from "@/lib/ai/generation/session-lesson";
import { planGenerationSession } from "@/lib/ai/generation/session-planning";
import { courseGenerationInputSchema } from "@/lib/ai/course-generation-schemas";
import type { CourseOutline } from "@/lib/ai/course-generation-session-schema";

vi.mock("@/lib/ai/generation/session-cover", () => ({ prepareOutlineCover: vi.fn(async () => ({ generatedCover: false })) }));
vi.mock("@/lib/ai/generation/session-planning", () => ({ planGenerationSession: vi.fn() }));
vi.mock("@/lib/ai/generation/session-lesson", () => ({ prepareSessionLesson: vi.fn() }));
const uri = process.env.RBAC_TEST_MONGODB_URI;
const database = `coursecraft_generation_test_${randomUUID().replaceAll("-", "")}`;
const ownerId = new Types.ObjectId().toString();
let scope: { ownerId: string; courseId: string };
const outline: CourseOutline = { title: "Approved course", description: "Course description", sections: [{ id: "learn", title: "Learn", lessons: Array.from({ length: 5 }, (_, index) => ({ id: `lesson-${index}`, title: `Lesson ${index + 1}`, objective: `Explain topic ${index + 1}`, kind: "learn" as const })) }] };
const input = courseGenerationInputSchema.parse({ prompt: "Teach five topics", audience: "Students", level: "beginner", lessonCount: 5, template: "custom", includeImages: false, courseTitle: "", courseDescription: "" });
const lessonDraft = (id: string) => editorLessonSchema.parse({ id, sectionId: "temporary-section", title: "AI title", order: 0, blocks: [{ id: `block-${id}`, version: 1, type: "richText", data: { html: `<p>Teaching content for ${id}</p>` } }] });
const models = [Asset, Course, Lesson, CourseGenerationSession, GenerationCheckpoint];

describe.skipIf(!uri)("incremental course generation in MongoDB", () => {
  beforeAll(async () => { await mongoose.connect(uri!, { dbName: database }); await Promise.all(models.map((model) => model.init())); }, 30_000);
  afterAll(async () => { if (mongoose.connection.name === database) await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(prepareOutlineCover).mockResolvedValue({ generatedCover: false, cover: undefined });
    await Promise.all(models.map((model) => mongoose.connection.db!.collection(model.collection.collectionName).deleteMany({})));
    const course = await Course.create({ ownerId, title: "Existing course", description: "", sections: [{ id: "original", title: "Original", order: 0 }] });
    scope = { ownerId, courseId: String(course._id) };
    vi.mocked(planGenerationSession).mockResolvedValue({ outline: structuredClone(outline), sourcePlan: null });
    vi.mocked(prepareSessionLesson).mockImplementation(async ({ item }) => lessonDraft(item.id));
  });
  async function approved() {
    const session = (await planSession(scope, input))!;
    const editor = await getCourseEditor(ownerId, scope.courseId);
    return approveSession(scope, session.id, outline, "replace", editor.revision);
  }
  async function completeNext(id: string) {
    await prepareNextLesson(scope, id);
    const editor = await getCourseEditor(ownerId, scope.courseId);
    return commitNextLesson(scope, id, editor.revision);
  }
  it("requires outline approval before writing lessons", async () => {
    const session = (await planSession(scope, input))!;
    await prepareNextLesson(scope, session.id);
    expect(prepareSessionLesson).not.toHaveBeenCalled();
    expect(await Lesson.countDocuments({ courseId: scope.courseId })).toBe(0);
  });
  it("saves added Custom sections and lessons and generates the new lessons in order", async () => {
    const session = (await planSession(scope, input))!;
    const custom: CourseOutline = { ...outline, sections: [...outline.sections, { id: "practice", title: "Practice", lessons: [
      { id: "practice-one", title: "Practice task", objective: "Apply the topics", kind: "learn" },
      { id: "practice-two", title: "Review", objective: "Review the topics", kind: "learn" },
    ] }] };
    const approved = await approveSession(scope, session.id, custom, "replace", 0);
    expect(approved.editor.sections).toHaveLength(2);
    expect(approved.editor.lessons.filter((lesson) => lesson.sectionId === "practice").map((lesson) => lesson.title)).toEqual(["Practice task", "Review"]);
    for (let index = 0; index < 7; index++) await completeNext(session.id);
    expect((await getSession(scope, session.id))!.completedLessonIds).toHaveLength(7);
    const saved = await getCourseEditor(ownerId, scope.courseId);
    expect(saved.lessons.find((lesson) => lesson.id === "practice-one")?.blocks).toHaveLength(1);
  });
  it("prepares the card image with the outline and saves only the dashboard image on approval", async () => {
    const asset = await Asset.create({ ownerId, courseId: scope.courseId, objectKey: randomUUID(), originalName: "cover.jpg", mimeType: "image/jpeg", size: 100, status: "ready" });
    const cover = courseCoverSchema.parse({ template: "image", imageSrc: `/api/assets/${asset._id}/file`, titleOnly: true });
    vi.mocked(prepareOutlineCover).mockResolvedValueOnce({ generatedCover: true, cover });
    const session = (await planSession(scope, input))!;
    expect(session.cover).toEqual(cover);
    expect((await Course.findById(scope.courseId).lean())!.coverImage).toBeNull();
    const approved = await approveSession(scope, session.id, outline, "replace", 0);
    expect(approved.editor.theme.cover).toBeUndefined();
    expect((await Course.findById(scope.courseId).lean())!.coverImage).toBe(cover.imageSrc);
    expect((await getCourseEditor(ownerId, scope.courseId)).theme.cover).toBeUndefined();
  });
  it("preserves a course image added by an author while the outline is being reviewed", async () => {
    const cover = courseCoverSchema.parse({ template: "image", imageSrc: `/api/assets/${new Types.ObjectId()}/file`, titleOnly: true });
    vi.mocked(prepareOutlineCover).mockResolvedValueOnce({ generatedCover: true, cover });
    const session = (await planSession(scope, input))!;
    await Course.updateOne({ _id: scope.courseId }, { $set: { coverImage: "https://example.com/author-cover.jpg" }, $inc: { revision: 1 } });
    const approved = await approveSession(scope, session.id, outline, "replace", 1);
    expect(approved.editor.theme.cover).toBeUndefined();
    expect((await Course.findById(scope.courseId).lean())!.coverImage).toBe("https://example.com/author-cover.jpg");
  });
  it("preserves the manually selected learner cover when applying a generated card image", async () => {
    const image = async (name: string) => Asset.create({ ownerId, courseId: scope.courseId, objectKey: randomUUID(), originalName: name, mimeType: "image/jpeg", size: 100, status: "ready" });
    const manual = await image("manual.jpg"), generated = await image("card.jpg");
    const learnerCover = courseCoverSchema.parse({ template: "image", imageSrc: `/api/assets/${manual._id}/file`, overlayOpacity: 70 });
    await Course.updateOne({ _id: scope.courseId }, { $set: { "theme.cover": learnerCover } });
    const card = courseCoverSchema.parse({ template: "image", imageSrc: `/api/assets/${generated._id}/file` });
    vi.mocked(prepareOutlineCover).mockResolvedValueOnce({ generatedCover: true, cover: card });
    const session = (await planSession(scope, input))!;
    const approved = await approveSession(scope, session.id, outline, "replace", 0);
    expect(approved.editor.theme.cover).toEqual(learnerCover);
    expect((await Course.findById(scope.courseId).lean())!.coverImage).toBe(card.imageSrc);
  });
  it("restores the old learner-cover format for previously auto-applied images while retaining the card image", async () => {
    const asset = await Asset.create({ ownerId, courseId: scope.courseId, objectKey: randomUUID(), originalName: "old-generated.jpg", mimeType: "image/jpeg", size: 100, status: "ready", metadata: { purpose: "course-cover" } });
    const cover = courseCoverSchema.parse({ template: "image", imageSrc: `/api/assets/${asset._id}/file`, titleOnly: true });
    await Course.updateOne({ _id: scope.courseId }, { $set: { "theme.cover": cover, "theme.primaryColor": "#123456", coverImage: cover.imageSrc } });
    const editor = await getCourseEditor(ownerId, scope.courseId);
    expect(editor.theme.cover).toBeUndefined();
    expect(editor.theme.primaryColor).toBe("#123456");
    await saveCourseEditor(ownerId, scope.courseId, editor);
    const saved = (await Course.findById(scope.courseId).lean())!;
    expect(saved.coverImage).toBe(cover.imageSrc);
    expect(saved.theme?.cover).toBeUndefined();
  });
  it("retains a reviewable outline when cover generation fails", async () => {
    vi.mocked(prepareOutlineCover).mockRejectedValueOnce(new Error("Image unavailable"));
    const session = (await planSession(scope, input))!;
    expect(session.status).toBe("outline"); expect(session.outline).toEqual(outline);
    expect(session.coverWarning).toContain("cover image could not be prepared");
    const approved = await approveSession(scope, session.id, outline, "replace", 0);
    expect(approved.editor.lessons).toHaveLength(5);
  });
  it("reports 2/5 only after two complete lessons are in the database", async () => {
    const { session } = await approved();
    expect(session!.completedLessonIds).toEqual([]);
    await prepareNextLesson(scope, session!.id);
    expect((await getSession(scope, session!.id))!.completedLessonIds).toEqual([]);
    const pendingLesson = await Lesson.findOne({ courseId: scope.courseId, editorId: "lesson-0" }).lean<{ blocks: unknown[] }>();
    expect(pendingLesson!.blocks).toEqual([]);
    await commitNextLesson(scope, session!.id, (await getCourseEditor(ownerId, scope.courseId)).revision);
    await completeNext(session!.id);
    const restored = (await getSession(scope, session!.id))!;
    expect(restored.completedLessonIds).toEqual(["lesson-0", "lesson-1"]);
    expect(restored.currentLessonId).toBe("lesson-2");
    const persisted = await Lesson.find({ courseId: scope.courseId, generationSessionId: session!.id }).lean();
    expect(persisted).toHaveLength(2);
    expect(persisted.every((lesson) => lesson.blocks.length > 0)).toBe(true);
    expect((await getCourseEditor(ownerId, scope.courseId)).lessons[0].title).toBe("Lesson 1");
  });
  it("preserves completed lessons through a failure, retries from the next lesson, and finishes", async () => {
    const { session } = await approved();
    await completeNext(session!.id); await completeNext(session!.id);
    vi.mocked(prepareSessionLesson).mockRejectedValueOnce(new Error("Provider unavailable"));
    await expect(prepareNextLesson(scope, session!.id)).rejects.toThrow("Provider unavailable");
    expect((await getSession(scope, session!.id))!.completedLessonIds).toHaveLength(2);
    for (let index = 2; index < 5; index++) await completeNext(session!.id);
    const complete = (await getSession(scope, session!.id))!;
    expect(complete.status).toBe("completed"); expect(complete.completedLessonIds).toHaveLength(5);
    expect(await Lesson.countDocuments({ courseId: scope.courseId })).toBe(5);
  });
  it("does not advance or overwrite edits when a save revision is stale", async () => {
    const { session, editor } = await approved();
    await prepareNextLesson(scope, session!.id);
    await saveCourseEditor(ownerId, scope.courseId, { ...editor, description: "Author edit" });
    await expect(commitNextLesson(scope, session!.id, editor.revision)).rejects.toThrow("course changed");
    expect((await getSession(scope, session!.id))!.completedLessonIds).toEqual([]);
    expect((await getSession(scope, session!.id))!.readyToSave).toBe(true);
    await commitNextLesson(scope, session!.id, editor.revision + 1);
    expect((await getCourseEditor(ownerId, scope.courseId)).description).toBe("Author edit");
  });
  it("keeps progress unchanged when the database lesson write fails", async () => {
    const { session, editor } = await approved(); await prepareNextLesson(scope, session!.id);
    const write = vi.spyOn(Lesson, "bulkWrite").mockRejectedValueOnce(new Error("Database write failed"));
    await expect(commitNextLesson(scope, session!.id, editor.revision)).rejects.toThrow("Database write failed");
    write.mockRestore();
    expect((await getSession(scope, session!.id))!.completedLessonIds).toEqual([]);
    expect((await getCourseEditor(ownerId, scope.courseId)).revision).toBe(editor.revision);
    await commitNextLesson(scope, session!.id, editor.revision);
    expect((await getSession(scope, session!.id))!.completedLessonIds).toHaveLength(1);
  });
  it("stores and rolls back completion receipts with the standalone MongoDB save path", async () => {
    const { session } = await approved();
    const unsupportedSession = { withTransaction: async () => { throw { code: 20, message: "Transaction numbers are only allowed on a replica set member or mongos" }; }, endSession: vi.fn() };
    const start = vi.spyOn(mongoose, "startSession").mockResolvedValue(unsupportedSession as unknown as Awaited<ReturnType<typeof mongoose.startSession>>);
    try {
      await completeNext(session!.id);
      await prepareNextLesson(scope, session!.id);
      const revision = (await getCourseEditor(ownerId, scope.courseId)).revision;
      const write = vi.spyOn(Lesson, "bulkWrite").mockRejectedValueOnce(new Error("Standalone write failed"));
      try { await expect(commitNextLesson(scope, session!.id, revision)).rejects.toThrow("Standalone write failed"); }
      finally { write.mockRestore(); }
      expect((await getSession(scope, session!.id))!.completedLessonIds).toEqual(["lesson-0"]);
      expect((await getCourseEditor(ownerId, scope.courseId)).revision).toBe(revision);
      await commitNextLesson(scope, session!.id, revision);
      expect((await getSession(scope, session!.id))!.completedLessonIds).toHaveLength(2);
    } finally { start.mockRestore(); }
  });
  it("recovers a lost approval response without inserting duplicate placeholders", async () => {
    const { session } = await approved();
    await CourseGenerationSession.updateOne({ _id: session!.id }, { $set: { status: "outline" } });
    expect((await getSession(scope, session!.id))!.status).toBe("generating");
    const retried = await approveSession(scope, session!.id, outline, "replace", 0);
    expect(retried.editor.lessons).toHaveLength(5);
    expect(await Lesson.countDocuments({ courseId: scope.courseId })).toBe(5);
  });
  it("recovers completion from the saved receipt even if session status was not updated", async () => {
    const { session } = await approved();
    for (let index = 0; index < 5; index++) await completeNext(session!.id);
    await CourseGenerationSession.updateOne({ _id: session!.id }, { $set: { status: "generating" } });
    const restored = (await getSession(scope, session!.id))!;
    expect(restored.status).toBe("completed");
    const beforeCalls = vi.mocked(prepareSessionLesson).mock.calls.length;
    await prepareNextLesson(scope, session!.id);
    expect(prepareSessionLesson).toHaveBeenCalledTimes(beforeCalls);
  });
  it("cancels remaining work while retaining saved lessons and rejects another owner", async () => {
    const { session } = await approved(); await completeNext(session!.id);
    const beforeCalls = vi.mocked(prepareSessionLesson).mock.calls.length;
    await cancelSession(scope, session!.id); await prepareNextLesson(scope, session!.id);
    expect(prepareSessionLesson).toHaveBeenCalledTimes(beforeCalls);
    expect((await getSession(scope, session!.id))!.completedLessonIds).toHaveLength(1);
    await expect(getSession({ ...scope, ownerId: new Types.ObjectId().toString() }, session!.id)).rejects.toThrow("not found");
  });
  it("does not overwrite a pending lesson that an author has filled", async () => {
    const { session, editor } = await approved(); await prepareNextLesson(scope, session!.id);
    const changed = { ...editor, lessons: editor.lessons.map((lesson, index) => index ? lesson : { ...lesson, blocks: lessonDraft("author").blocks }) };
    await saveCourseEditor(ownerId, scope.courseId, changed);
    await expect(commitNextLesson(scope, session!.id, editor.revision + 1)).rejects.toThrow("edits were preserved");
    expect((await getSession(scope, session!.id))!.completedLessonIds).toEqual([]);
  });
});
