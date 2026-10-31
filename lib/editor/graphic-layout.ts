import { z } from "zod";

export const graphicImageFitSchema = z.enum(["fill", "contain", "cover", "none", "scale-down"]);
export type GraphicImageFit = z.infer<typeof graphicImageFitSchema>;
type Size = { width: number; height: number };

/** Match CSS object-fit so image pixels and hotspot coordinates use the same rectangle. */
export function fitGraphicImage(frame: Size, image: Size, fit: GraphicImageFit) {
  if (fit === "fill" || ![frame.width, frame.height, image.width, image.height].every((value) => Number.isFinite(value) && value > 0)) {
    return { left: 0, top: 0, width: frame.width, height: frame.height };
  }
  const contain = Math.min(frame.width / image.width, frame.height / image.height);
  const scale = fit === "cover" ? Math.max(frame.width / image.width, frame.height / image.height)
    : fit === "none" ? 1 : fit === "scale-down" ? Math.min(1, contain) : contain;
  const width = image.width * scale;
  const height = image.height * scale;
  return { left: (frame.width - width) / 2, top: (frame.height - height) / 2, width, height };
}

export function projectGraphicPoint(point: { x: number; y: number }, frame: Size, image: ReturnType<typeof fitGraphicImage>) {
  if (!frame.width || !frame.height) return point;
  return { x: (image.left + image.width * point.x / 100) / frame.width * 100, y: (image.top + image.height * point.y / 100) / frame.height * 100 };
}

export function unprojectGraphicPoint(point: { x: number; y: number }, frame: Size, image: ReturnType<typeof fitGraphicImage>) {
  if (!image.width || !image.height) return point;
  return { x: (frame.width * point.x / 100 - image.left) / image.width * 100, y: (frame.height * point.y / 100 - image.top) / image.height * 100 };
}
