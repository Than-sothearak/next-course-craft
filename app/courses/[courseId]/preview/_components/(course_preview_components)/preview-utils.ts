import type { CSSProperties } from "react";
import { backgroundPaint, parseGradient, representativeColor, solidColor } from "@/lib/color";
import { defaultSlideMaster, defaultSlideBorderRadius, resolveSlideBackground } from "@/lib/editor/slide-design";
import {
  defaultBlockPaddingForBlock,
  defaultBlockWidthForBlock,
  type ContentBlock,
} from "@/lib/schemas/block";
export function contrastTextColor(hex: string) {
  hex = representativeColor(hex);
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

export function blockSurfaceStyle(block: ContentBlock, slideLayout = false): CSSProperties {
  const configuredPadding = block.blockPadding ?? defaultBlockPaddingForBlock(block);
  const blockPadding = slideLayout ? Math.min(configuredPadding, 12) : configuredPadding;
  return {
    ...backgroundPaint(slideLayout ? "transparent" : block.backgroundColor),
    color: slideLayout ? "inherit" : contrastTextColor(block.backgroundColor),
    paddingTop: `${blockPadding}px`,
    paddingBottom: `${blockPadding}px`,
  };
}

/** Paint a slide object's fill once, without reducing the opacity of its content. */
export function slideObjectSurfaceStyle(
  block: ContentBlock,
  slideColor = defaultSlideMaster.backgroundColor,
  slideTextColor = defaultSlideMaster.textColor,
): CSSProperties {
  const { color, opacity } = resolveSlideBackground(block);
  const radius = `${block.slideBorderRadius ?? defaultSlideBorderRadius}px`;
  const shape = { borderRadius: radius, "--slide-object-radius": radius, "--slide-text-paint": parseGradient(slideTextColor) ? slideTextColor : "none", "--slide-text-fill": parseGradient(slideTextColor) ? "transparent" : slideTextColor } as CSSProperties;
  if (opacity === 0) return { ...shape, backgroundColor: "transparent", color: solidColor(slideTextColor) };
  const representative = representativeColor(color);
  const canvas = representativeColor(slideColor);
  const channels = [1, 3, 5].map((index) => Number.parseInt(representative.slice(index, index + 2), 16));
  const alpha = opacity / 100;
  const blendedColor = "#" + channels.map((channel, index) => {
    const canvasChannel = Number.parseInt(canvas.slice(index * 2 + 1, index * 2 + 3), 16);
    return Math.round(channel * alpha + canvasChannel * (1 - alpha)).toString(16).padStart(2, "0");
  }).join("");
  return {
    ...shape,
    ...backgroundPaint(color, opacity),
    "--slide-text-paint": "none",
    "--slide-text-fill": contrastTextColor(blendedColor),
    color: contrastTextColor(blendedColor),
  } as CSSProperties;
}
