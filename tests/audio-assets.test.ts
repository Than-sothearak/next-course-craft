import { beforeEach, describe, expect, it, vi } from "vitest";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
const { find, lean } = vi.hoisted(() => ({ find: vi.fn(), lean: vi.fn() }));
vi.mock("@/models/Asset", () => ({ Asset: { find } }));
import { assertCourseAudioAssets } from "@/lib/editor/services/audio-assets";
const id = "507f1f77bcf86cd799439011";
function lessons(src = `/api/assets/${id}/file`) {
  return editorSnapshotSchema.parse({ title: "Course", description: "", revision: 0, sections: [{ id: "s", title: "Section", order: 0 }], lessons: [{
    id: "l", sectionId: "s", title: "Lesson", order: 0,
    blocks: [{ id: "audio", version: 1, type: "audio", data: { src } }],
  }] }).lessons;
}
beforeEach(() => { vi.clearAllMocks(); find.mockReturnValue({ select: () => ({ lean }) }); lean.mockResolvedValue([{ _id: id }]); });
describe("audio asset ownership on editor saves", () => {
  it("requires ready audio in the current owner/course and deduplicates references", async () => {
    const input = lessons();
    input[0].blocks.push({ ...input[0].blocks[0], id: "second-audio" });
    await assertCourseAudioAssets("owner", "course", input);
    expect(find).toHaveBeenCalledWith({ _id: { $in: [id] }, ownerId: "owner", courseId: "course", status: "ready", mimeType: /^audio\// });
  });
  it("rejects unavailable, foreign, and non-audio assets", async () => {
    lean.mockResolvedValue([]);
    await expect(assertCourseAudioAssets("owner", "course", lessons())).rejects.toThrow("this course’s media library");
  });
  it("allows an empty audio block without querying assets", async () => {
    await assertCourseAudioAssets("owner", "course", lessons(""));
    expect(find).not.toHaveBeenCalled();
  });
});
