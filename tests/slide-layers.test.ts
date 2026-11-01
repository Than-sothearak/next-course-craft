import { describe, expect, it } from "vitest";
import { blockSchema } from "@/lib/schemas/block";
import { getSlideLayers, reorderSlideLayers } from "@/lib/editor/slide-layers";
import { resolveSlideFrame } from "@/lib/editor/slide-design";

const make = (id: string, z?: number) => blockSchema.parse({ id, version: 1, type: "heading", data: { text: id, level: 2 }, ...(z === undefined ? {} : { slideFrame: { x: 5, y: 10, width: 40, height: 20, z } }) });
const blocks = [make("back", 0), make("middle", 8), make("front", 500)];

describe("presentation object layers", () => {
  it("matches painting order with sparse, duplicate, and missing layer values", () => {
    expect(getSlideLayers(blocks).map((block) => block.id)).toEqual(["front", "middle", "back"]);
    expect(getSlideLayers([make("first", 4), make("second", 4), make("third", 4)]).map((block) => block.id)).toEqual(["third", "second", "first"]);
    expect(getSlideLayers([make("first"), make("second"), make("third")]).map((block) => block.id)).toEqual(["third", "second", "first"]);
  });

  it.each([["front", "back", ["middle", "back", "front"]], ["back", "front", ["back", "front", "middle"]]])("moves %s to %s and preserves authored content, geometry, and reading order", (activeId, overId, order) => {
    const next = reorderSlideLayers(blocks, activeId, overId);
    expect(getSlideLayers(next).map((block) => block.id)).toEqual(order);
    expect(next.map((block) => block.id)).toEqual(blocks.map((block) => block.id));
    next.forEach((block, index) => {
      expect(block).toEqual({ ...blocks[index], slideFrame: { ...blocks[index].slideFrame, z: block.slideFrame!.z } });
      expect(blockSchema.safeParse(block).success).toBe(true);
    });
    expect(blocks.map((block) => block.slideFrame!.z)).toEqual([0, 8, 500]);
  });

  it("materializes existing fallback frames before changing their layers", () => {
    const legacy = [make("first"), make("second"), make("third")];
    const next = reorderSlideLayers(legacy, "first", "third", { width: 1200, height: 800 });
    next.forEach((block, index) => expect(block.slideFrame).toEqual({ ...resolveSlideFrame(legacy[index], index, legacy.length, { width: 1200, height: 800 }), z: block.slideFrame!.z }));
    expect(getSlideLayers(next).map((block) => block.id)).toEqual(["first", "third", "second"]);
  });

  it("ignores unchanged and stale drag targets", () => {
    for (const [from, to] of [["front", "front"], ["missing", "front"], ["front", "missing"]]) expect(reorderSlideLayers(blocks, from, to)).toBe(blocks);
    expect(reorderSlideLayers([], "front", "back")).toEqual([]);
  });
});
