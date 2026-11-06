"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { MediaLibraryDialog, type MediaLibraryAsset } from "@/app/courses/[courseId]/edit/_components/media-library-dialog";
import { audioBlockSchema, type ContentBlock } from "@/lib/schemas/block";

type SlideMediaKind = "image" | "video" | "audio" | "attachment";
type SlideMediaBlock = Extract<ContentBlock, { type: "image" | "gallery" | "labeledGraphic" | "video" | "audio" | "attachment" }>;

export function slideMediaKind(block: ContentBlock): SlideMediaKind | null {
  if (block.type === "image" || block.type === "gallery" || block.type === "labeledGraphic") return "image";
  if (block.type === "video" || block.type === "audio" || block.type === "attachment") return block.type;
  return null;
}

export function SlideMediaPicker({ block, courseId, onChange, embedded = false, onClose }: {
  block: ContentBlock;
  courseId: string;
  onChange: (block: ContentBlock) => void;
  embedded?: boolean;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const kind = slideMediaKind(block);
  if (!kind) return null;
  const mediaBlock = block as SlideMediaBlock;

  function choose(asset: MediaLibraryAsset) {
    setError(null);
    if (mediaBlock.type === "image") onChange({ ...mediaBlock, slideCrop: undefined, data: { ...mediaBlock.data, src: asset.fileUrl } });
    else if (mediaBlock.type === "labeledGraphic") onChange({ ...mediaBlock, data: { ...mediaBlock.data, src: asset.fileUrl, mapTemplate: undefined } });
    else if (mediaBlock.type === "gallery") {
      const images = [...mediaBlock.data.images];
      const position = galleryIndex ?? 0;
      if (position >= images.length) images.push({ src: asset.fileUrl, alt: asset.originalName.slice(0, 500) });
      else images[position] = { ...images[position], src: asset.fileUrl };
      onChange({ ...mediaBlock, data: { ...mediaBlock.data, images } });
    } else if (mediaBlock.type === "video") {
      if (asset.contentType !== "video/mp4" && asset.contentType !== "video/webm") { setError("Choose an MP4 or WebM video."); return; }
      onChange({ ...mediaBlock, slideCrop: undefined, data: { ...mediaBlock.data, src: asset.fileUrl, mimeType: asset.contentType } });
    } else if (mediaBlock.type === "audio") {
      const parsed = audioBlockSchema.safeParse({ ...mediaBlock, data: { src: asset.fileUrl, fileName: asset.originalName, mimeType: asset.contentType } });
      if (!parsed.success) { setError("Choose a supported audio file."); return; }
      onChange(parsed.data);
    } else if (mediaBlock.type === "attachment") onChange({ ...mediaBlock, data: { src: asset.fileUrl, fileName: asset.originalName, size: asset.size } });
  }

  const label = kind === "attachment" ? "Choose or upload file" : `Choose or upload ${kind}`;
  return (
    <div className={embedded ? "flex min-h-0 flex-1 flex-col gap-2" : "space-y-2 rounded-lg border border-indigo-100 bg-indigo-50/50 p-3"}>
      {!embedded && <p className="text-xs font-semibold text-slate-700">Slide media</p>}
      {embedded && mediaBlock.type === "gallery" ? <label className="flex shrink-0 items-center gap-2 text-sm">Replace image<Select aria-label="Gallery image to replace" value={galleryIndex ?? 0} onChange={(event) => setGalleryIndex(Number(event.target.value))}>{mediaBlock.data.images.map((image, index) => <option key={index} value={index}>Image {index + 1}{image.alt ? `: ${image.alt}` : ""}</option>)}</Select></label> : !embedded && <>
      {mediaBlock.type === "gallery" ? <>
        {mediaBlock.data.images.map((image, index) => <Button key={`${mediaBlock.id}-${index}`} type="button" variant="outline" size="sm" onClick={() => { setGalleryIndex(index); setOpen(true); }} className="w-full justify-start">Replace image {index + 1}</Button>)}
        {mediaBlock.data.images.length < 8 && <Button type="button" variant="outline" size="sm" onClick={() => { setGalleryIndex(mediaBlock.data.images.length); setOpen(true); }} className="w-full justify-start">Add gallery image</Button>}
      </> : <Button type="button" variant="outline" size="sm" onClick={() => { setGalleryIndex(null); setOpen(true); }} className="w-full justify-start">{label}</Button>}
      {(mediaBlock.type === "audio" || mediaBlock.type === "attachment") && mediaBlock.data.fileName && <p className="break-all text-xs text-slate-500">Selected: {mediaBlock.data.fileName}</p>}
      </>}
      {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
      <MediaLibraryDialog courseId={courseId} kind={kind} embedded={embedded} open={embedded || open} onClose={() => { setOpen(false); onClose?.(); }} onSelect={choose} />
    </div>
  );
}
