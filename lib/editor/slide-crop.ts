import { z } from "zod";
import type { CSSProperties } from "react";

export const cropRectSchema = z.object({
  x: z.number().min(0).max(99), y: z.number().min(0).max(99),
  width: z.number().min(1).max(100), height: z.number().min(1).max(100),
}).refine((rect) => rect.x + rect.width <= 100.000001 && rect.y + rect.height <= 100.000001, "Keep the crop inside the media.");
export const slideCropSchema = cropRectSchema.safeExtend({ source: z.string().min(1) });
export type CropRect = z.infer<typeof cropRectSchema>;
export type SlideCrop = z.infer<typeof slideCropSchema>;
export const fullCrop: CropRect = { x: 0, y: 0, width: 100, height: 100 };
export type CropCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export function resolveSlideCrop(block: { slideCrop?: SlideCrop; data: { src: string } }) {
  return block.slideCrop?.source === block.data.src ? block.slideCrop : undefined;
}
export function croppedDimensions<T extends { width: number; height: number }>(media: T, crop?: CropRect): T {
  return crop ? { ...media, width: media.width * crop.width / 100, height: media.height * crop.height / 100 } : media;
}
export function croppedMediaStyle(crop: CropRect): CSSProperties {
  return { position: "absolute", maxWidth: "none", width: `${10000 / crop.width}%`, height: `${10000 / crop.height}%`, left: `${-100 * crop.x / crop.width}%`, top: `${-100 * crop.y / crop.height}%`, objectFit: "fill" };
}
/** Fit the cropped viewport without stretching when the minimum object size limits its ratio. */
export function cropViewportStyle(dimensions: { width: number; height: number }, crop: CropRect): CSSProperties {
  const size = croppedDimensions(dimensions, crop), aspect = size.width / size.height;
  return { width: `min(100cqw, calc(100cqh * ${aspect}))`, height: `min(100cqh, calc(100cqw / ${aspect}))`, flexShrink: 0 };
}
export function moveCrop(rect: CropRect, dx: number, dy: number): CropRect {
  return { ...rect, x: Math.max(0, Math.min(100 - rect.width, rect.x + dx)), y: Math.max(0, Math.min(100 - rect.height, rect.y + dy)) };
}
/** ratio is width/height in source percentage coordinates, rather than pixels. */
export function resizeCrop(rect: CropRect, corner: CropCorner, dx: number, dy: number, ratio?: number): CropRect {
  const right = corner.endsWith("right"), bottom = corner.startsWith("bottom");
  const ax = right ? rect.x : rect.x + rect.width, ay = bottom ? rect.y : rect.y + rect.height;
  const maxWidth = right ? 100 - ax : ax, maxHeight = bottom ? 100 - ay : ay;
  let width = rect.width + (right ? dx : -dx), height = rect.height + (bottom ? dy : -dy);
  if (ratio) {
    if (Math.abs(dy / rect.height) > Math.abs(dx / rect.width)) width = height * ratio;
    const minWidth = Math.max(1, ratio), limit = Math.min(maxWidth, maxHeight * ratio);
    if (limit < minWidth) return rect;
    width = Math.max(minWidth, Math.min(limit, width)); height = width / ratio;
  } else { width = Math.max(1, Math.min(maxWidth, width)); height = Math.max(1, Math.min(maxHeight, height)); }
  return { x: right ? ax : ax - width, y: bottom ? ay : ay - height, width, height };
}
export function cropToAspect(rect: CropRect, source: { width: number; height: number }, aspect: number): CropRect {
  const ratio = aspect / (source.width / source.height);
  const width = Math.min(rect.width, rect.height * ratio), height = width / ratio;
  if (width < 1 || height < 1) return rect;
  return { x: rect.x + (rect.width - width) / 2, y: rect.y + (rect.height - height) / 2, width, height };
}

export function isSlideVideoFile(block: { data: { src: string; mimeType?: string } }) {
  return Boolean(block.data.mimeType) || /\.(mp4|webm|ogg)(?:$|[?#])/i.test(block.data.src) || /^data:video\//i.test(block.data.src);
}
