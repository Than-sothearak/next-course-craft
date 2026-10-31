import { beforeEach, describe, expect, it, vi } from "vitest";
const { courseFind, lessonFind, courseLean, lessonLean } = vi.hoisted(() => ({ courseFind: vi.fn(), lessonFind: vi.fn(), courseLean: vi.fn(), lessonLean: vi.fn() }));
vi.mock("@/models", () => ({ Course: { findOne: courseFind }, Lesson: { find: lessonFind }, User: {} }));
import { getCourseEditor } from "@/lib/editor/services/course";
import { editorSnapshotSchema } from "@/lib/editor/schemas";

const courseId = "a".repeat(24), ownerId = "b".repeat(24), src = `/api/assets/${"c".repeat(24)}/file`;
describe("loading existing cover audio", () => {
  beforeEach(() => {
    vi.clearAllMocks(); courseFind.mockReturnValue({ lean: courseLean }); lessonFind.mockReturnValue({ sort: () => ({ lean: lessonLean }) });
    courseLean.mockResolvedValue({ _id: courseId, title: "Course", description: "", revision: 1, courseLayout: "slides", sections: [{ id: "section", title: "Slides", order: 0 }] });
    lessonLean.mockResolvedValue([{ _id: "d".repeat(24), editorId: "cover", sectionId: "section", title: "Cover", order: 0, blocks: [], slideCover: { template: "imageCover", instructions: { audioSrc: src, audioName: "Welcome.mp3", audioTrigger: "cover", noticeEnabled: true, noticeTitle: "Welcome" } } }]);
  });
  it("returns an editable instruction object for editor, preview and export without writing to the database", async () => {
    const loaded = await getCourseEditor(ownerId, courseId);
    expect(loaded.lessons[0].blocks).toMatchObject([{ type: "audioInstruction", data: { src, fileName: "Welcome.mp3", autoPlay: true } }]);
    expect(loaded.lessons[0].slideCover?.instructions).toMatchObject({ audioSrc: "", noticeEnabled: true, noticeTitle: "Welcome" });
    expect(editorSnapshotSchema.safeParse(loaded).success).toBe(true);
    expect(courseFind).toHaveBeenCalledWith({ _id: courseId, ownerId, deletedAt: null });
  });
});
