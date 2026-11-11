import { beforeEach, describe, expect, it, vi } from "vitest";
import { editorSnapshotSchema } from "@/lib/editor/schemas";
import { interactionButtonBlockSchema, peelToRevealBlockSchema, hangingRopeCardsBlockSchema, processStepsBlockSchema } from "@/lib/schemas/block";

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
  it.each([false, true])("checks step media and inline instruction links, nested in a popup: %s", async (nested) => {
    const content = lessons();
    const process = processStepsBlockSchema.parse({ id: "steps", type: "processSteps", version: 1, data: { steps: [
      { id: "one", body: "Instructions", bodyHtml: `<p><a href="${url("b")}">Download guide</a></p>`, media: { src: url("a"), fileName: "Guide.png", mimeType: "image/png", size: 100 } },
      { id: "two", body: "Finish" },
    ] } });
    content[0].blocks = nested ? [interactionButtonBlockSchema.parse({ id: "popup", type: "interactionButton", version: 1, data: { popup: { blocks: [process] } } })] : [process];
    await assertInteractionButtonAssets("owner", "course", content);
    expect(find).toHaveBeenCalledWith({ _id: { $in: ["a".repeat(24)] }, ownerId: "owner", courseId: "course", status: "ready", mimeType: /^image\// });
    expect(find).toHaveBeenCalledWith({ _id: { $in: ["b".repeat(24)] }, ownerId: "owner", courseId: "course", status: "ready" });
    lean.mockResolvedValue([]);
    await expect(assertInteractionButtonAssets("owner", "course", content)).rejects.toThrow("media library");
  });
  it("checks owned ready media within every hanging card and rejects foreign or unavailable assets", async () => {
    const content = lessons(); content[0].blocks = [hangingRopeCardsBlockSchema.parse({ id: "ropes", type: "hangingRopeCards", version: 1, data: { cards: [{ id: "one", blocks: [
      { id: "image", type: "image", version: 1, data: { src: url("a"), alt: "Image" } },
      { id: "video", type: "video", version: 1, data: { src: url("b"), mimeType: "video/mp4" } },
      { id: "audio", type: "audio", version: 1, data: { src: url("c") } },
    ] }] } })]; await assertInteractionButtonAssets("owner", "course", content); expect(find).toHaveBeenCalledTimes(3);
    for (const [kind, id] of [["image", "a"], ["video", "b"], ["audio", "c"]]) expect(find).toHaveBeenCalledWith({ _id: { $in: [id.repeat(24)] }, ownerId: "owner", courseId: "course", status: "ready", mimeType: new RegExp(`^${kind}/`) });
    lean.mockResolvedValue([]); await expect(assertInteractionButtonAssets("owner", "course", content)).rejects.toThrow("media library");
  });
  it("validates course ownership and media types inside peel reveals, including nested popups", async () => {
    const content = lessons();
    const peel = peelToRevealBlockSchema.parse({ id: "paper", type: "peelToReveal", version: 1, data: { blocks: [
      { id: "image", type: "image", version: 1, data: { src: url("a"), alt: "Diagram" } },
      { id: "video", type: "video", version: 1, data: { src: url("b"), mimeType: "video/mp4" } },
      { id: "audio", type: "audio", version: 1, data: { src: url("c"), fileName: "Narration" } },
      { id: "rich", type: "richText", version: 1, data: { html: `<p><img src="${url("d")}" alt="Inline"></p>` } },
    ] } });
    content[0].blocks = [peel]; await assertInteractionButtonAssets("owner", "course", content); expect(find).toHaveBeenCalledTimes(4);
    for (const [kind, id] of [["image", "a"], ["video", "b"], ["audio", "c"]]) expect(find).toHaveBeenCalledWith({ _id: { $in: [id.repeat(24)] }, ownerId: "owner", courseId: "course", status: "ready", mimeType: new RegExp(`^${kind}/`) });
    content[0].blocks = [interactionButtonBlockSchema.parse({ id: "popup", type: "interactionButton", version: 1, data: { popup: { blocks: [peel] } } })];
    lean.mockResolvedValue([]); await expect(assertInteractionButtonAssets("owner", "course", content)).rejects.toThrow("media library");
  });
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

  it("verifies ready course ownership and media types throughout nested buttons and all media blocks", async () => {
    const content = lessons();
    content[0].blocks = [interactionButtonBlockSchema.parse({ id: "outer", version: 1, type: "interactionButton", data: { popup: { blocks: [
      { id: "inner", version: 1, type: "interactionButton", data: { imageSrc: url("a"), popup: { blocks: [
        { id: "gallery", version: 1, type: "gallery", data: { images: [{ src: url("a"), alt: "Gallery" }] } },
        { id: "cards", version: 1, type: "flipCard", data: { cards: [{ id: "one", frontLabel: "Front", backLabel: "Back", front: { type: "image", src: url("a"), alt: "Front" }, back: { type: "text", text: "Back" } }] } },
        { id: "graphic", version: 1, type: "labeledGraphic", data: { src: url("a"), alt: "Map", markers: [{ id: "point", label: "Point", description: "Detail", x: 50, y: 50 }] } },
        { id: "instruction", version: 1, type: "audioInstruction", data: { src: url("c") } },
        { id: "file", version: 1, type: "attachment", data: { src: url("d"), fileName: "Document.pdf" } },
        { id: "text", version: 1, type: "richText", data: { html: `<p><img src="${url("e")}" alt="Inline image"></p>` } },
      ] } } },
    ] } } })];
    await assertInteractionButtonAssets("owner", "course", content);
    expect(find).toHaveBeenCalledTimes(4);
    for (const [kind, id] of [["image", "a"], ["audio", "c"]]) expect(find).toHaveBeenCalledWith({ _id: { $in: [id.repeat(24)] }, ownerId: "owner", courseId: "course", status: "ready", mimeType: new RegExp(`^${kind}/`) });
    for (const id of ["d", "e"]) expect(find).toHaveBeenCalledWith({ _id: { $in: [id.repeat(24)] }, ownerId: "owner", courseId: "course", status: "ready" });
    lean.mockResolvedValue([]);
    await expect(assertInteractionButtonAssets("owner", "course", content)).rejects.toThrow("media library");
  });
});
