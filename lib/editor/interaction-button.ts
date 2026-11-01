import type { ContentBlock } from "@/lib/schemas/block";

export const interactionIcons = ["info", "help", "play", "volume", "book", "lightbulb", "star", "plus", "pin", "pointer", "check", "gift", "image", "video", "message", "search", "flag", "heart", "globe", "settings", "arrow", "file", "headphones", "sparkles"] as const;

export const interactionButtonPositions = [
  "top-left", "top-center", "top-right",
  "middle-left", "middle-center", "middle-right",
  "bottom-left", "bottom-center", "bottom-right",
] as const;

export function isInteractionTarget(block: ContentBlock, buttonId: string) {
  return block.id !== buttonId && block.type !== "interactionButton" && !(block.type === "divider" && block.data.style === "continue");
}

/** Popup-local targets must follow their scoped IDs in learner rendering. */
export function scopePopupBlocks(blocks: readonly ContentBlock[], ownerId: string): ContentBlock[] {
  const ids = new Map(blocks.map((block) => [block.id, `${ownerId}-popup-${block.id}`]));
  return blocks.map((block) => block.type === "interactionButton"
    ? { ...block, id: ids.get(block.id)!, data: { ...block.data, targetBlockId: ids.get(block.data.targetBlockId) ?? "" } }
    : { ...block, id: ids.get(block.id)! });
}
