import type { ContentBlock } from "@/lib/schemas/block";
import { fitSlideFrame, fitSlideMediaFrame, slideObjectArea, type SlideFrame, type SlideMedia, type SlideSize } from "./slide-design";
import { croppedDimensions, resolveSlideCrop } from "./slide-crop";

export function isSlideMediaObject(block: ContentBlock): block is Extract<ContentBlock, { type: "image" | "video" }> {
  return block.type === "video" || (block.type === "image" && (!block.data.layout || block.data.layout === "full"));
}

export function resolveSlideMedia(block: ContentBlock): SlideMedia | undefined {
  return isSlideMediaObject(block) && block.slideMedia?.source === block.data.src ? block.slideMedia : undefined;
}

export function resolveSlideDisplayMedia(block: ContentBlock): SlideMedia | undefined {
  const media = resolveSlideMedia(block);
  return media && isSlideMediaObject(block) ? croppedDimensions(media, resolveSlideCrop(block)) : media;
}

export function resizeSlideObjectFrame(block: ContentBlock, frame: SlideFrame, update: Partial<SlideFrame>, area: SlideSize = slideObjectArea): SlideFrame {
  if (!isSlideMediaObject(block) || (update.width === undefined && update.height === undefined)) return fitSlideFrame(frame, update);
  const media = resolveSlideDisplayMedia(block) ?? { width: frame.width * area.width, height: frame.height * area.height };
  return fitSlideMediaFrame(fitSlideFrame(frame, { x: update.x, y: update.y, z: update.z }), media, update, area);
}

/** Use screen pixels so the footer snap feels the same at every canvas zoom. */
export function snapSlideFrameToFooter(frame: SlideFrame, displayedHeight: number, distance = 8): { frame: SlideFrame; snapped: boolean } {
  const gap = (100 - frame.y - frame.height) / 100 * displayedHeight;
  const snapped = displayedHeight > 0 && gap >= -0.01 && gap <= distance;
  return { frame: snapped ? { ...frame, y: 100 - frame.height } : frame, snapped };
}
