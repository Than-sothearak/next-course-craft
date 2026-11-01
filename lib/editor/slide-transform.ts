import type { ContentBlock } from "@/lib/schemas/block";
import { fitSlideFrame, minimumSlideAudioHeight, type SlideFrame, type SlideSize } from "./slide-design";
import { isSlideMediaObject } from "./slide-objects";

export const slideResizeHandles = [
  { id: "top-left", x: -1, y: -1, cursor: "nwse-resize" },
  { id: "top", x: 0, y: -1, cursor: "ns-resize" },
  { id: "top-right", x: 1, y: -1, cursor: "nesw-resize" },
  { id: "right", x: 1, y: 0, cursor: "ew-resize" },
  { id: "bottom-right", x: 1, y: 1, cursor: "nwse-resize" },
  { id: "bottom", x: 0, y: 1, cursor: "ns-resize" },
  { id: "bottom-left", x: -1, y: 1, cursor: "nesw-resize" },
  { id: "left", x: -1, y: 0, cursor: "ew-resize" },
] as const;
export type SlideResizeHandle = typeof slideResizeHandles[number]["id"];

export function normalizeSlideRotation(degrees: number): number {
  const value = ((degrees % 360) + 360) % 360;
  return Math.round(value * 100) / 100 % 360;
}

export function rotateSlideFrame(frame: SlideFrame, startAngle: number, angle: number, snap = false): SlideFrame {
  const rotation = (frame.rotation ?? 0) + (angle - startAngle) * 180 / Math.PI;
  return { ...frame, rotation: normalizeSlideRotation(snap ? Math.round(rotation / 15) * 15 : rotation) };
}

/** Deltas are logical canvas pixels; resize in the object's rotated local axes. */
export function resizeSlideFrameFromHandle(
  block: ContentBlock, frame: SlideFrame, handle: SlideResizeHandle,
  delta: { x: number; y: number }, area: SlideSize,
): SlideFrame {
  const direction = slideResizeHandles.find((item) => item.id === handle)!;
  const radians = (frame.rotation ?? 0) * Math.PI / 180;
  const cos = Math.cos(radians), sin = Math.sin(radians);
  const dx = delta.x * cos + delta.y * sin;
  const dy = -delta.x * sin + delta.y * cos;
  const width = frame.width / 100 * area.width, height = frame.height / 100 * area.height;
  const minimumWidth = area.width * .05;
  const minimumHeight = area.height * (block.type === "audio" ? minimumSlideAudioHeight / 100 : .05);
  let nextWidth = Math.max(minimumWidth, width + direction.x * dx);
  let nextHeight = Math.max(minimumHeight, height + direction.y * dy);
  if (isSlideMediaObject(block)) {
    const scaleX = direction.x * dx / width, scaleY = direction.y * dy / height;
    const change = direction.x === 0 ? scaleY : direction.y === 0 ? scaleX
      : Math.abs(scaleX) >= Math.abs(scaleY) ? scaleX : scaleY;
    const scale = Math.max(minimumWidth / width, minimumHeight / height, 1 + change);
    nextWidth = width * scale;
    nextHeight = height * scale;
  }

  // Moving the center by half the size change fixes the opposite edge/corner.
  const localX = direction.x * (nextWidth - width) / 2;
  const localY = direction.y * (nextHeight - height) / 2;
  const x = frame.x / 100 * area.width + localX * cos - localY * sin - (nextWidth - width) / 2;
  const y = frame.y / 100 * area.height + localX * sin + localY * cos - (nextHeight - height) / 2;
  const startX = frame.x / 100 * area.width, startY = frame.y / 100 * area.height;
  let fraction = 1;
  const bounds = [
    [startX, x, 0, area.width * .95], [startY, y, 0, area.height - minimumHeight],
    [startX + width, x + nextWidth, 0, area.width],
    [startY + height, y + nextHeight, 0, area.height],
  ];
  for (const [start, end, min, max] of bounds) {
    if (end < min) fraction = Math.min(fraction, (min - start) / (end - start));
    if (end > max) fraction = Math.min(fraction, (max - start) / (end - start));
  }
  // Interpolate the whole gesture at a boundary, retaining its anchor and ratio.
  const percent = (value: number, extent: number) => Math.round(value / extent * 100 * 1e10) / 1e10;
  return fitSlideFrame(frame, {
    x: percent(startX + (x - startX) * fraction, area.width),
    y: percent(startY + (y - startY) * fraction, area.height),
    width: percent(width + (nextWidth - width) * fraction, area.width),
    height: percent(height + (nextHeight - height) * fraction, area.height),
  }, block.type === "audio" ? minimumSlideAudioHeight : undefined);
}
