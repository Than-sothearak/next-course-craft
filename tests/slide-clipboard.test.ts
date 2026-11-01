import { describe, expect, it } from "vitest";
import { blockSchema, type ContentBlock } from "@/lib/schemas/block";
import { pasteSlideObject, readSlideObjectClipboard, serializeSlideObject } from "@/lib/editor/slide-clipboard";
import { resolveSlideFrame } from "@/lib/editor/slide-design";

const area = { width: 960, height: 540 };
const frame = { x: 17, y: 23, width: 44, height: 31, rotation: 37, z: 2 };
const heading = () => blockSchema.parse({ id: "heading", version: 1, type: "heading", slideFrame: frame, slideTextLayout: { fitToText: false }, slideAnimation: { effect: "zoom", duration: 1000, delay: 200 }, data: { text: "Copy this", html: "<h2><strong>Copy this</strong></h2>", level: 2 } });
function ids() { let id = 0; return () => `copy-${++id}`; }

describe("presentation object clipboard", () => {
  it("round trips the complete object and preserves exact geometry on repeated pastes", () => {
    const source = heading(), serialized = serializeSlideObject("course", source, 0, 1, area);
    const copied = readSlideObjectClipboard(serialized, "course")!;
    expect(copied).toEqual(source);
    const createId = ids(), destination = [source];
    for (let index = 0; index < 3; index++) {
      const pasted = pasteSlideObject(copied, destination, createId);
      expect(pasted).toEqual({ ...source, id: `copy-${index + 1}`, slideFrame: { ...frame, z: 3 + index } });
      destination.push(pasted);
    }
    expect(source.slideFrame).toEqual(frame);
  });

  it("captures fallback geometry before changing the number of slide objects", () => {
    const source = heading();
    delete source.slideFrame;
    const copied = readSlideObjectClipboard(serializeSlideObject("course", source, 3, 6, area), "course")!;
    const pasted = pasteSlideObject(copied, [], ids());
    expect(pasted.slideFrame).toEqual({ ...resolveSlideFrame(source, 3, 6, area), z: 0 });
  });

  it("regenerates popup and reveal identities, keeps nested links internal, and retains media references", () => {
    const image = blockSchema.parse({ id: "image", type: "image", version: 1, data: { src: "/api/assets/123456789012345678901234/file", alt: "Diagram" } });
    const nestedButton = { id: "nested", type: "interactionButton", version: 1, data: { action: "block", targetBlockId: image.id } };
    const source = blockSchema.parse({ id: "popup", type: "interactionButton", version: 1, slideFrame: frame, data: { popup: { blocks: [image, nestedButton, { id: "peel", type: "peelToReveal", version: 1, data: {} }] } } });
    const pasted = pasteSlideObject(source, [], ids());
    if (source.type !== "interactionButton" || pasted.type !== "interactionButton") throw new Error("Expected popup");
    const original = source.data.popup.blocks, copies = pasted.data.popup.blocks;
    expect(pasted.id).not.toBe(source.id);
    copies.forEach((block, index) => expect(block.id).not.toBe(original[index].id));
    expect(copies[0].data).toEqual(image.data);
    expect(copies[1]).toMatchObject({ data: { targetBlockId: copies[0].id } });
    const peel = copies[2], originalPeel = original[2];
    if (peel.type !== "peelToReveal" || originalPeel.type !== "peelToReveal") throw new Error("Expected peel");
    expect(peel.data.blocks[0].id).not.toBe(originalPeel.data.blocks[0].id);
    expect(blockSchema.safeParse(pasted).success).toBe(true);
    expect(source.data.popup.blocks[0].id).toBe("image");
  });

  it("preserves a link to an existing object only when that target is on the destination slide", () => {
    const target = heading();
    const source = blockSchema.parse({ id: "button", type: "interactionButton", version: 1, slideFrame: frame, data: { action: "block", targetBlockId: target.id } });
    expect(pasteSlideObject(source, [target], ids())).toMatchObject({ data: { targetBlockId: target.id } });
    expect(pasteSlideObject(source, [], ids())).toMatchObject({ data: { targetBlockId: "" } });
  });

  it("keeps an independent snapshot of styles and content while putting copies on the front layer", () => {
    const source = heading(), copied = readSlideObjectClipboard(serializeSlideObject("course", source, 0, 1, area), "course")!;
    const destination: ContentBlock[] = [{ ...source, id: "front", slideFrame: { ...frame, z: 500 } }];
    const pasted = pasteSlideObject(copied, destination, ids());
    if (source.type !== "heading" || pasted.type !== "heading") throw new Error("Expected heading");
    source.data.text = "Changed after copying";
    expect(pasted.data.text).toBe("Copy this");
    expect(pasted.slideFrame).toEqual({ ...frame, z: 500 });
    expect(pasted.data).not.toBe(source.data);
  });

  it("ignores ordinary clipboard content and rejects invalid objects or objects from other courses", () => {
    for (const value of ["", "Some text", "<p>Rich text</p>", "null", '{"example":"json"}']) expect(readSlideObjectClipboard(value, "course")).toBeNull();
    const payload = JSON.parse(serializeSlideObject("course", heading(), 0, 1, area));
    expect(() => readSlideObjectClipboard(JSON.stringify({ ...payload, version: 2 }), "course")).toThrow("invalid");
    expect(() => readSlideObjectClipboard(JSON.stringify({ ...payload, block: { ...payload.block, slideFrame: { ...frame, rotation: "bad" } } }), "course")).toThrow("invalid");
    expect(() => readSlideObjectClipboard(JSON.stringify(payload), "different-course")).toThrow("from this course");
  });
});
