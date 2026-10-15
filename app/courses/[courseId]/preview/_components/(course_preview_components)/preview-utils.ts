import type { CSSProperties } from "react";
import {
  defaultBlockPaddingForBlock,
  defaultBlockWidthForBlock,
  type ContentBlock,
} from "@/lib/schemas/block";
export function contrastTextColor(hex: string) {
  const channels = hex
    .match(/[\da-f]{2}/gi)
    ?.map((channel) => Number.parseInt(channel, 16) / 255);
  if (!channels || channels.length < 3) return "#111827";
  const luminance = channels
    .slice(0, 3)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    )
    .reduce(
      (sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index],
      0,
    );
  return luminance > 0.42 ? "#111827" : "#ffffff";
}

export function safeImageSource(value: string) {
  const source = value.trim();
  return /^https?:\/\//i.test(source) ||
    /^data:image\/[\w.+-]+;base64,/i.test(source) ||
    (source.startsWith("./") && !source.slice(2).split("/").some((part) => part === ".." || part === "")) ||
    (source.startsWith("/") && !source.startsWith("//"))
    ? source
    : "";
}

export function blockWidthClass(block: ContentBlock) {
  const contentWidth = block.widthCustom ? block.width : defaultBlockWidthForBlock(block);
  return contentWidth === "small"
    ? "max-w-[520px]"
    : contentWidth === "medium"
      ? "max-w-[720px]"
      : "max-w-[920px]";
}

export function blockSurfaceStyle(block: ContentBlock): CSSProperties {
  const blockPadding = block.blockPadding ?? defaultBlockPaddingForBlock(block);
  return {
    backgroundColor: block.backgroundColor,
    color: contrastTextColor(block.backgroundColor),
    paddingTop: `${blockPadding}px`,
    paddingBottom: `${blockPadding}px`,
  };
}
