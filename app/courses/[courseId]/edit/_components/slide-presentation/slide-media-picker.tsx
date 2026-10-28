"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MediaLibraryDialog, type MediaLibraryAsset } from "../media-library-dialog";
import { audioBlockSchema, type ContentBlock } from "@/lib/schemas/block";

type SlideMediaKind = "image" | "video" | "audio" | "attachment";
type SlideMediaBlock = Extract<ContentBlock, { type: "image" | "gallery" | "labeledGraphic" | "video" | "audio" | "attachment" }>;

function mediaKind(block: ContentBlock): SlideMediaKind | null {
  if (block.type === "image" || block.type === "gallery" || block.type === "labeledGraphic") return "image";
  if (block.type === "video" || block.type === "audio" || block.type === "attachment") return block.type;
  return null;
}

export function SlideMediaPicker({ block, courseId, onChange }: {
  block: ContentBlock;
  courseId: string;
  onChange: (block: ContentBlock) => void;
}) {
  const [open, setOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const kind = mediaKind(block);
  if (!kind) return null;
  const mediaBlock = block as SlideMediaBlock;

  function choose(asset: MediaLibraryAsset) {
    setError(null);
    if (mediaBlock.type === "image") onChange({ ...mediaBlock, data: { ...mediaBlock.data, src: asset.fileUrl } });
    else if (mediaBlock.type === "labeledGraphic") onChange({ ...mediaBlock, data: { ...mediaBlock.data, src: asset.fileUrl } });
    else if (mediaBlock.type === "gallery") {
      const images = [...mediaBlock.data.images];
      const position = galleryIndex ?? 0;
      if (position >= images.length) images.push({ src: asset.fileUrl, alt: asset.originalName.slice(0, 500) });
      else images[position] = { ...images[position], src: asset.fileUrl };
      onChange({ ...mediaBlock, data: { images } });
    } else if (mediaBlock.type === "video") {
      if (asset.contentType !== "video/mp4" && asset.contentType !== "video/webm") { setError("Choose an MP4 or WebM video."); return; }
      onChange({ ...mediaBlock, data: { ...mediaBlock.data, src: asset.fileUrl, mimeType: asset.contentType } });
    } else if (mediaBlock.type === "audio") {
      const parsed = audioBlockSchema.safeParse({ ...mediaBlock, data: { src: asset.fileUrl, fileName: asset.originalName, mimeType: asset.contentType } });
      if (!parsed.success) { setError("Choose a supported audio file."); return; }
      onChange(parsed.data);
    } else if (mediaBlock.type === "attachment") onChange({ ...mediaBlock, data: { src: asset.fileUrl, fileName: asset.originalName, size: asset.size } });
  }

  const label = kind === "attachment" ? "Choose or upload file" : `Choose or upload ${kind}`;
  return (
    <div className="space-y-2 rounded-lg border border-indigo-100 bg-indigo-50/50 p-3">
      <p className="text-xs font-semibold text-slate-700">Slide media</p>
      {mediaBlock.type === "gallery" ? <>
        {mediaBlock.data.images.map((image, index) => <Button key={`${mediaBlock.id}-${index}`} type="button" variant="outline" size="sm" onClick={() => { setGalleryIndex(index); setOpen(true); }} className="w-full justify-start">Replace image {index + 1}</Button>)}
        {mediaBlock.data.images.length < 8 && <Button type="button" variant="outline" size="sm" onClick={() => { setGalleryIndex(mediaBlock.data.images.length); setOpen(true); }} className="w-full justify-start">Add gallery image</Button>}
      </> : <Button type="button" variant="outline" size="sm" onClick={() => { setGalleryIndex(null); setOpen(true); }} className="w-full justify-start">{label}</Button>}
      {(mediaBlock.type === "audio" || mediaBlock.type === "attachment") && mediaBlock.data.fileName && <p className="break-all text-xs text-slate-500">Selected: {mediaBlock.data.fileName}</p>}
      {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
      <MediaLibraryDialog courseId={courseId} kind={kind} open={open} onClose={() => setOpen(false)} onSelect={choose} />
    </div>
  );
}
