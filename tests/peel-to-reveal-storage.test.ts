import mongoose, { Types } from "mongoose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { hangingRopeCardsBlockSchema } from "@/lib/schemas/block";
const { courseFind, courseUpdate, lessonFind, bulkWrite, deleteMany } = vi.hoisted(() => ({ courseFind: vi.fn(), courseUpdate: vi.fn(), lessonFind: vi.fn(), bulkWrite: vi.fn(), deleteMany: vi.fn() }));
vi.mock("@/models", () => ({ Course: { findOne: courseFind, findOneAndUpdate: courseUpdate }, Lesson: { find: lessonFind, bulkWrite, deleteMany }, User: {} }));
vi.mock("@/lib/editor/services/course-cover", () => ({ assertCourseCoverAsset: vi.fn() }));
vi.mock("@/lib/editor/services/audio-assets", () => ({ assertCourseAudioAssets: vi.fn() }));
vi.mock("@/lib/editor/services/slide-cover-assets", () => ({ assertSlideCoverAssets: vi.fn() }));
vi.mock("@/lib/editor/services/slide-master-assets", () => ({ assertSlideMasterAsset: vi.fn() }));
vi.mock("@/lib/editor/services/interaction-button-assets", () => ({ assertInteractionButtonAssets: vi.fn() }));
import { saveCourseEditor } from "@/lib/editor/services/save";
import { getCourseEditor } from "@/lib/editor/services/course";
import { assertInteractionButtonAssets } from "@/lib/editor/services/interaction-button-assets";
const ownerId = "aaaaaaaaaaaaaaaaaaaaaaaa", courseId = "bbbbbbbbbbbbbbbbbbbbbbbb";
const initial = () => editorSnapshotSchema.parse({ title: "Discover", description: "", revision: 1, sections: [{ id: "section", title: "Ideas", order: 0 }], lessons: [{ id: "lesson", sectionId: "section", title: "Discovery", order: 0, blocks: [{ id: "paper", type: "peelToReveal", version: 1, requiredForProgress: false, data: { paperColor: "#fef3c7", direction: "bottom-left", trigger: "drag", physicsPreset: "soft", damping: 19, animationDuration: 1200, blocks: [{ id: "rich", type: "richText", version: 1, data: { html: '<p><strong>Keep formatting</strong></p>' } }, { id: "image", type: "image", version: 1, data: { src: `/api/assets/${"c".repeat(24)}/file`, alt: "Discovery image" } }] } }] }] });
describe("Peel to Reveal owner-scoped persistence", () => {
  beforeEach(() => { vi.clearAllMocks(); const session = { withTransaction: async (callback: () => Promise<void>) => callback(), endSession: vi.fn() }; vi.spyOn(mongoose, "startSession").mockResolvedValue(session as unknown as Awaited<ReturnType<typeof mongoose.startSession>>); courseUpdate.mockResolvedValue({ _id: new Types.ObjectId(courseId), revision: 2 }); courseFind.mockReturnValue({ lean: async () => ({ ...initial(), _id: new Types.ObjectId(courseId) }) }); deleteMany.mockResolvedValue({ deletedCount: 0 }); });
  afterEach(() => vi.restoreAllMocks());
  it.each(["peelToReveal", "hangingRopeCards"] as const)("saves %s formatting and media references and reloads without changing child IDs", async (type) => {
    const snapshot = initial();
    if (type === "hangingRopeCards") { const original = snapshot.lessons[0].blocks[0]; if (original.type !== "peelToReveal") throw new Error("Wrong fixture"); snapshot.lessons[0].blocks = [hangingRopeCardsBlockSchema.parse({ id: "ropes", type, version: 1, data: { cards: [{ id: "one", title: "Discover", blocks: original.data.blocks }] } })]; }
    await expect(saveCourseEditor(ownerId, courseId, snapshot)).resolves.toEqual({ revision: 2 });
    expect(assertInteractionButtonAssets).toHaveBeenCalledWith(ownerId, courseId, snapshot.lessons);
    expect(courseUpdate.mock.calls[0][0]).toMatchObject({ _id: courseId, ownerId, deletedAt: null, revision: 1 });
    const writes = bulkWrite.mock.calls[0][0]; expect(writes[0].updateOne.update.$set.blocks).toEqual(snapshot.lessons[0].blocks);
    lessonFind.mockReturnValue({ sort: () => ({ lean: async () => writes.map(({ updateOne }: { updateOne: { filter: { editorId: string }; update: { $set: object } } }) => ({ editorId: updateOne.filter.editorId, ...updateOne.update.$set })) }) });
    const loaded = editorSnapshotSchema.parse(await getCourseEditor(ownerId, courseId)); expect(courseFind.mock.calls[0][0]).toEqual({ _id: courseId, ownerId, deletedAt: null }); expect(loaded.lessons[0].blocks).toEqual(snapshot.lessons[0].blocks);
  });
});
