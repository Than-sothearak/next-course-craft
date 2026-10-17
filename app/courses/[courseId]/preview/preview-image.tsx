"use client";

/* eslint-disable @next/next/no-img-element -- The shared preview also ships in static course exports. */
import { useEffect, useRef, useState } from "react";
import { Expand, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PreviewImage({
  src,
  alt,
  caption,
  className,
}: {
  src: string;
  alt: string;
  caption?: string;
  className: string;
}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

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
        className="cursor-pointer group relative block w-full cursor-zoom-in rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
      >
        <img src={src} alt={alt} width={1200} height={675} className={className} />
        <span
          aria-hidden="true"
          className="absolute bottom-2 right-2 grid size-8 place-items-center rounded-full bg-white/90 text-slate-800 shadow-sm"
        >
          <Expand size={16} />
        </span>
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
          <img
            src={src}
            alt={alt}
            className="max-h-[calc(100dvh-7rem)] max-w-full object-contain"
          />
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
