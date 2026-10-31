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
