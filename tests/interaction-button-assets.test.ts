import { beforeEach, describe, expect, it, vi } from "vitest";
import { editorSnapshotSchema } from "@/lib/editor/schemas";

const { find, lean } = vi.hoisted(() => ({ find: vi.fn(), lean: vi.fn() }));
vi.mock("@/models/Asset", () => ({ Asset: { find } }));
import { assertInteractionButtonAssets } from "@/lib/editor/services/interaction-button-assets";

const url = (id: string) => `/api/assets/${id.repeat(24)}/file`;
const lessons = () => editorSnapshotSchema.parse({ title: "Presentation", description: "", revision: 0, sections: [{ id: "section", title: "Slides", order: 0 }], lessons: [{ id: "slide", title: "Slide", sectionId: "section", order: 0, blocks: [{ id: "button", type: "interactionButton", version: 1, data: { trigger: "image", imageSrc: url("a"), popup: { blocks: [
  { id: "image", version: 1, type: "image", data: { src: url("a"), alt: "Diagram" } },
  { id: "video", version: 1, type: "video", data: { src: url("b") } },
  { id: "audio", version: 1, type: "audio", data: { src: url("c"), fileName: "Voice" } },
] } } }] }] }).lessons;

describe("interaction button asset ownership", () => {
  beforeEach(() => { vi.clearAllMocks(); find.mockReturnValue({ select: () => ({ lean }) }); lean.mockResolvedValue([{ _id: "asset" }]); });
  it("deduplicates nested assets and verifies ready ownership, course and each media type", async () => {
    await assertInteractionButtonAssets("owner", "course", lessons());
    expect(find).toHaveBeenCalledTimes(3);
    for (const [kind, id] of [["image", "a"], ["video", "b"], ["audio", "c"]]) expect(find).toHaveBeenCalledWith({ _id: { $in: [id.repeat(24)] }, ownerId: "owner", courseId: "course", status: "ready", mimeType: new RegExp(`^${kind}/`) });
  });
  it("rejects a missing, foreign, unready or wrong-type result", async () => {
    lean.mockResolvedValue([]);
    await expect(assertInteractionButtonAssets("owner", "course", lessons())).rejects.toThrow("media library");
  });
  it.each(["https://example.com/map.png", "./media/map.png", "data:image/png;base64,YQ=="])("rejects a non-library authoring URL: %s", async (src) => {
    const content = lessons(), block = content[0].blocks[0];
    if (block.type !== "interactionButton") throw new Error("Wrong type");
    block.data.popup.blocks[0].data = { src, alt: "Map" };
    await expect(assertInteractionButtonAssets("owner", "course", content)).rejects.toThrow("media library");
  });
  it("does not query assets for an icon/text-only popup", async () => {
    const content = lessons(), block = content[0].blocks[0];
    if (block.type !== "interactionButton") throw new Error("Wrong type");
    block.data.imageSrc = ""; block.data.popup.blocks = [];
    await assertInteractionButtonAssets("owner", "course", content); expect(find).not.toHaveBeenCalled();
  });
});
