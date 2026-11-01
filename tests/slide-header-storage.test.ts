import mongoose, { Types } from "mongoose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editorSnapshotSchema } from "@/lib/editor/schemas";

const { courseFind, courseUpdate, lessonFind, bulkWrite, deleteMany } = vi.hoisted(() => ({ courseFind: vi.fn(), courseUpdate: vi.fn(), lessonFind: vi.fn(), bulkWrite: vi.fn(), deleteMany: vi.fn() }));
vi.mock("@/models", () => ({ Course: { findOne: courseFind, findOneAndUpdate: courseUpdate }, Lesson: { find: lessonFind, bulkWrite, deleteMany }, User: {} }));
vi.mock("@/lib/editor/services/course-cover", () => ({ assertCourseCoverAsset: vi.fn() }));
vi.mock("@/lib/editor/services/audio-assets", () => ({ assertCourseAudioAssets: vi.fn() }));
vi.mock("@/lib/editor/services/slide-cover-assets", () => ({ assertSlideCoverAssets: vi.fn() }));
vi.mock("@/lib/editor/services/slide-master-assets", () => ({ assertSlideMasterAsset: vi.fn() }));
vi.mock("@/lib/editor/services/interaction-button-assets", () => ({ assertInteractionButtonAssets: vi.fn() }));
import { saveCourseEditor } from "@/lib/editor/services/save";
import { getCourseEditor } from "@/lib/editor/services/course";

const ownerId = "aaaaaaaaaaaaaaaaaaaaaaaa", courseId = "bbbbbbbbbbbbbbbbbbbbbbbb";
const initial = () => editorSnapshotSchema.parse({ title: "Presentation", description: "", revision: 1, courseLayout: "slides", sections: [{ id: "section", title: "Slides", order: 0 }], lessons: [
  { id: "long", sectionId: "section", title: "A long title", order: 0, blocks: [], slideHeaderStyle: { fontSize: 22, color: "#123456", textAlign: "right" } },
  { id: "short", sectionId: "section", title: "Short", order: 1, blocks: [] },
] });

describe("per-slide header persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const session = { withTransaction: async (callback: () => Promise<void>) => callback(), endSession: vi.fn() };
    vi.spyOn(mongoose, "startSession").mockResolvedValue(session as unknown as Awaited<ReturnType<typeof mongoose.startSession>>);
    courseUpdate.mockResolvedValue({ _id: new Types.ObjectId(courseId), revision: 2 });
    courseFind.mockReturnValue({ lean: async () => ({ ...initial(), _id: new Types.ObjectId(courseId) }) });
    deleteMany.mockResolvedValue({ deletedCount: 0 });
  });
  afterEach(() => vi.restoreAllMocks());

  it("writes and reloads independent header styles, including clearing an override", async () => {
    const snapshot = initial();
    snapshot.lessons[0].slideAppearance = { hideHeader: true, hideFooter: false, background: { type: "image", imageSrc: "/api/assets/123456789012345678901234/file", imagePosition: "center", overlayOpacity: 0 } };
    await expect(saveCourseEditor(ownerId, courseId, snapshot)).resolves.toEqual({ revision: 2 });
    expect(courseUpdate.mock.calls[0][0]).toMatchObject({ _id: courseId, ownerId, deletedAt: null, revision: 1 });
    const writes = bulkWrite.mock.calls[0][0];
    expect(writes[0].updateOne.filter).toEqual({ courseId: new Types.ObjectId(courseId), editorId: "long" });
    expect(writes[0].updateOne.update.$set.slideHeaderStyle).toEqual(snapshot.lessons[0].slideHeaderStyle);
    expect(writes[1].updateOne.update.$set.slideHeaderStyle).toBeNull();
    expect(writes[0].updateOne.update.$set.slideAppearance).toEqual(snapshot.lessons[0].slideAppearance);
    expect(writes[1].updateOne.update.$set.slideAppearance).toBeNull();
    lessonFind.mockReturnValue({ sort: () => ({ lean: async () => writes.map(({ updateOne }: { updateOne: { filter: { editorId: string }; update: { $set: object } } }) => ({ editorId: updateOne.filter.editorId, ...updateOne.update.$set })) }) });
    const restored = editorSnapshotSchema.parse(await getCourseEditor(ownerId, courseId));
    expect(courseFind.mock.calls[0][0]).toEqual({ _id: courseId, ownerId, deletedAt: null });
    expect(restored.lessons[0].slideHeaderStyle).toEqual(snapshot.lessons[0].slideHeaderStyle);
    expect(restored.lessons[1].slideHeaderStyle).toBeUndefined();
    expect(restored.lessons[0].slideAppearance).toEqual(snapshot.lessons[0].slideAppearance);
    expect(restored.lessons[1].slideAppearance).toBeUndefined();
    restored.lessons[0].slideHeaderStyle = undefined;
    restored.lessons[0].slideAppearance = undefined;
    await saveCourseEditor(ownerId, courseId, restored);
    expect(bulkWrite.mock.calls[1][0][0].updateOne.update.$set.slideHeaderStyle).toBeNull();
    expect(bulkWrite.mock.calls[1][0][0].updateOne.update.$set.slideAppearance).toBeNull();
  });
});
