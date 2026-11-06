"use client";

import { galleryImageFitClass } from "@/lib/editor/gallery";
import type { ContentBlock } from "@/lib/schemas/block";
import { PreviewImage } from "../../preview/preview-image";

/** Size the gallery from its slide object, rather than fixed image aspect ratios. */
export function SlideGallery({ images, imageFit }: { images: Extract<ContentBlock, { type: "gallery" }>["data"]["images"]; imageFit?: "contain" | "cover" | "fill" }) {
  const columns = Math.min(images.length, 3);
  const rows = Math.ceil(images.length / columns);
  return <div data-slide-gallery className="grid h-full min-h-0 w-full min-w-0 gap-2" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}>
    {images.map((image, index) => <div key={index} data-slide-gallery-item data-slide-animation-item className="min-h-0 min-w-0 overflow-hidden rounded-lg">
      <PreviewImage src={image.src} alt={image.alt} fitFrame className={`h-full w-full ${galleryImageFitClass(image.fit ?? imageFit ?? "cover")}`} />
    </div>)}
  </div>;
}
