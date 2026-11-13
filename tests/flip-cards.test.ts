import { describe, expect, it } from "vitest";
import { blockSchema, flipCardPresentationLayoutSchema } from "@/lib/schemas/block";
import { defaultFlipCardLayout, duplicateFlipCard, flipCardGrid, moveFlipCard, type FlipCardBlock } from "@/lib/editor/flip-cards";
import { createBlocksFromTemplate, createSlideBlocksFromTemplate } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/create-blocks-from-template";
import { blockTemplates } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(block_template_picker_components)/block-template-data";
import { duplicateLessonBlocks } from "@/lib/editor/course-content";
import { getFlipCardProgressId } from "@/lib/export/progress";

const template = blockTemplates.find((item) => item.id === "interactive-reveal")!;
const sample = (): FlipCardBlock => {
  const block = blockSchema.parse(createSlideBlocksFromTemplate(template, "cards")[0]);
  if (block.type !== "flipCard") throw new Error("Expected cards");
  return block;
};

describe("presentation flip cards", () => {
  it("starts new standard and presentation blocks with two cards", () => {
    const block = sample(), other = sample();
    expect(block.data.cards).toHaveLength(2);
    expect(new Set([...block.data.cards, ...other.data.cards].map((card) => card.id)).size).toBe(4);
    expect(block.blockPadding).toBe(0);
    expect(block.data.presentationLayout).toEqual(defaultFlipCardLayout);
    const standard = createBlocksFromTemplate(template, "standard")[0];
    expect(standard.type === "flipCard" && standard.data.cards).toHaveLength(2);
  });

  it("retains legacy cards and validates optional layout and color overrides", () => {
    const legacy = blockSchema.parse({ id: "legacy", type: "flipCard", version: 1, data: { frontLabel: "Q", front: "Original", backLabel: "A", back: "Answer" } });
    expect(legacy.type === "flipCard" && legacy.data.cards).toHaveLength(1);
    const block = sample();
    block.data.cards[1].backgroundColor = "#ff9900";
    block.data.cards[1].textColor = "#000000";
    expect(blockSchema.parse(block)).toEqual(block);
    for (const invalid of [{ padding: -1 }, { cardPadding: 81 }, { rowGap: 1.5 }, { mode: "bad" }, { textAlign: "justify" }]) expect(flipCardPresentationLayoutSchema.safeParse(invalid).success).toBe(false);
    expect(blockSchema.safeParse({ ...block, data: { ...block.data, cards: [{ ...block.data.cards[0], backgroundColor: "bad" }] } }).success).toBe(false);
  });

  it("duplicates beside its source with independent content, styling, and progress", () => {
    const block = sample(), source = block.data.cards[1];
    source.backgroundColor = "#112233";
    const next = duplicateFlipCard(block, source.id, "copy");
    expect(next.data.cards.map((card) => card.id)).toEqual([block.data.cards[0].id, source.id, "copy"]);
    expect(next.data.cards[2]).toEqual({ ...source, id: "copy" });
    expect(next.data.cards[2].front).not.toBe(source.front);
    expect(getFlipCardProgressId(block.id, "copy")).not.toBe(getFlipCardProgressId(block.id, source.id));
    expect(duplicateFlipCard(block, source.id, source.id)).toBe(block);
    const full = { ...block, data: { ...block.data, cards: Array.from({ length: 30 }, (_, index) => ({ ...source, id: String(index) })) } };
    expect(duplicateFlipCard(full, "0", "copy")).toBe(full);
  });

  it("reorders without replacing card IDs and retains settings through whole-object copying", () => {
    const block = sample();
    block.data.cards[0].backgroundColor = "#112233";
    const next = moveFlipCard(block, block.data.cards[0].id, 1);
    expect(next.data.cards.map((card) => card.id)).toEqual([block.data.cards[1].id, block.data.cards[0].id]);
    let counter = 0;
    const [copy] = duplicateLessonBlocks([block], () => `copy-${++counter}`);
    expect(copy.type === "flipCard" && copy.data.presentationLayout).toEqual(block.data.presentationLayout);
    expect(copy.type === "flipCard" && copy.data.cards[0].backgroundColor).toBe("#112233");
    expect(copy.type === "flipCard" && copy.data.cards.every((card) => !block.data.cards.some((original) => original.id === card.id))).toBe(true);
  });

  it("fills bounded grids in auto and custom modes without overflowing dense small objects", () => {
    expect(flipCardGrid(3, 3, defaultFlipCardLayout, 720, 300)).toMatchObject({ columns: 3, rows: 1 });
    expect(flipCardGrid(3, 3, defaultFlipCardLayout, 250, 300)).toMatchObject({ columns: 1, rows: 3 });
    expect(flipCardGrid(5, 3, { ...defaultFlipCardLayout, mode: "custom" }, 250, 300)).toMatchObject({ columns: 3, rows: 2 });
    for (const [width,height] of [[120,80], [800,100], [150,800]]) {
      const grid = flipCardGrid(30, 5, { ...defaultFlipCardLayout, padding: 80, columnGap: 80, rowGap: 80 }, width, height);
      expect(grid.padding * 2 + grid.columnGap * (grid.columns - 1)).toBeLessThan(width);
      expect(grid.padding * 2 + grid.rowGap * (grid.rows - 1)).toBeLessThan(height);
    }
  });
});
