"use client";

/* eslint-disable @next/next/no-img-element -- The shared preview also ships in static course exports. */
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { croppedDimensions, croppedMediaStyle, cropViewportStyle, type CropRect } from "@/lib/editor/slide-crop";

export function PreviewImage({
  src,
  alt,
  caption,
  className,
  fitFrame = false,
  dimensions,
  onDimensions,
  crop,
}: {
  src: string;
  alt: string;
  caption?: string;
  className: string;
  fitFrame?: boolean;
  dimensions?: { width: number; height: number };
  onDimensions?: (dimensions: { width: number; height: number }) => void;
  crop?: CropRect;
}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cropped = fitFrame ? crop : undefined;
  const displayDimensions = croppedDimensions(dimensions ?? { width: 1, height: 1 }, cropped);
  const aspect = displayDimensions.width / displayDimensions.height;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && dialog && !dialog.open) dialog.showModal();
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label={`View image full screen${alt ? `: ${alt}` : ""}`}
        onClick={() => setOpen(true)}
        className={`cursor-pointer group relative w-full cursor-zoom-in rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${cropped ? "flex items-center justify-center" : "block"} ${fitFrame ? "h-full" : ""}`}
        style={cropped ? { containerType: "size" } : undefined}
      >
        <span data-slide-media-crop={cropped ? true : undefined} className={cropped ? "relative block h-full w-full overflow-hidden" : "contents"} style={cropped && dimensions ? cropViewportStyle(dimensions, cropped) : undefined}><img src={src} alt={alt} width={dimensions?.width ?? (fitFrame ? undefined : 1200)} height={dimensions?.height ?? (fitFrame ? undefined : 675)} style={cropped ? croppedMediaStyle(cropped) : undefined} onLoad={(event) => {
          const image = event.currentTarget;
          if (image.naturalWidth && image.naturalHeight) onDimensions?.({ width: image.naturalWidth, height: image.naturalHeight });
        }} className={className} /></span>
      </button>
      <dialog
        ref={dialogRef}
        aria-label={alt ? `Image preview: ${alt}` : "Image preview"}
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialogRef.current?.close();
        }}
        className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none overflow-hidden border-0 bg-black/95 p-0 text-white backdrop:bg-black/80"
      >
        <div className="relative flex h-full w-full flex-col items-center justify-center p-4 sm:p-8">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Close image preview"
            onClick={() => dialogRef.current?.close()}
            className="absolute right-3 top-3 z-10 size-10 rounded-full bg-white/10 text-white hover:bg-white/20 hover:text-white sm:right-5 sm:top-5"
          >
            <X size={20} />
          </Button>
          <div className={cropped ? "relative w-full overflow-hidden" : "contents"} style={cropped ? { aspectRatio: aspect, maxWidth: `calc((100dvh - 7rem) * ${aspect})` } : undefined}><img
            src={src}
            alt={alt}
            className="max-h-[calc(100dvh-7rem)] max-w-full object-contain"
            style={cropped ? { ...croppedMediaStyle(cropped), maxHeight: "none" } : undefined}
          /></div>
          {caption && (
            <p className="mt-3 max-w-5xl text-center text-sm text-white/80">
              {caption}
            </p>
          )}
        </div>
      </dialog>
    </>
  );
}
