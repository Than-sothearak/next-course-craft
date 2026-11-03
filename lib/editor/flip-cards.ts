import type { ContentBlock } from "@/lib/schemas/block";

export type FlipCardBlock = Extract<ContentBlock, { type: "flipCard" }>;
export type FlipCard = FlipCardBlock["data"]["cards"][number];
export type FlipCardLayout = NonNullable<FlipCardBlock["data"]["presentationLayout"]>;
export const defaultFlipCardLayout: FlipCardLayout = { mode: "auto", padding: 12, cardPadding: 16, columnGap: 12, rowGap: 12, borderRadius: 16, textAlign: "center" };

export function duplicateFlipCard(block: FlipCardBlock, cardId: string, newId: string): FlipCardBlock {
  const index = block.data.cards.findIndex((card) => card.id === cardId);
  if (index < 0 || block.data.cards.length >= 30 || block.data.cards.some((card) => card.id === newId)) return block;
  const cards = [...block.data.cards];
  cards.splice(index + 1, 0, { ...structuredClone(cards[index]), id: newId });
  return { ...block, data: { ...block.data, cards } };
}

export function moveFlipCard(block: FlipCardBlock, cardId: string, targetIndex: number): FlipCardBlock {
  const index = block.data.cards.findIndex((card) => card.id === cardId);
  if (index < 0 || targetIndex < 0 || targetIndex >= block.data.cards.length || targetIndex === index) return block;
  const cards = [...block.data.cards];
  const [card] = cards.splice(index, 1);
  cards.splice(targetIndex, 0, card);
  return { ...block, data: { ...block.data, cards } };
}

export function flipCardGrid(count: number, preferredColumns: number, layout: FlipCardLayout, width: number, height: number) {
  const padding = Math.min(layout.padding, width / 4, height / 4);
  const availableWidth = Math.max(0, width - padding * 2), availableHeight = Math.max(0, height - padding * 2);
  const columns = Math.max(1, Math.min(count, preferredColumns, layout.mode === "auto" ? Math.max(1, Math.floor((availableWidth + layout.columnGap) / (144 + layout.columnGap))) : preferredColumns));
  const rows = Math.max(1, Math.ceil(count / columns));
  return { columns, rows, padding, columnGap: Math.min(layout.columnGap, availableWidth / Math.max(1, (columns - 1) * 2)), rowGap: Math.min(layout.rowGap, availableHeight / Math.max(1, (rows - 1) * 2)) };
}
