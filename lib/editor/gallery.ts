import type { ContentBlock } from "@/lib/schemas/block";

type ImageFit = NonNullable<Extract<ContentBlock, { type: "gallery" }>["data"]["imageFit"]>;

export function galleryImageFitClass(fit: ImageFit) {
  return { contain: "object-contain", cover: "object-cover", fill: "object-fill" }[fit];
}
