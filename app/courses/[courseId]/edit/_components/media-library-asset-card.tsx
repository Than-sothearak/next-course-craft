"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { FileDown, LoaderCircle, Music2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mediaFileTypeLabel, type MediaLibraryAsset } from "@/lib/media/library";

function formatMediaSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function MediaPreview({ asset, onSelect }: { asset: MediaLibraryAsset; onSelect: () => void }) {
  const playerRef = useRef<HTMLMediaElement | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const player = playerRef.current;
    return () => { if (player && !player.paused) player.pause(); };
  }, [asset.fileUrl]);

  if (asset.contentType.startsWith("video/") || asset.contentType.startsWith("audio/")) {
    const video = asset.contentType.startsWith("video/");
    return <>
      <div className={`flex aspect-[16/10] min-w-0 flex-col items-center justify-center gap-3 overflow-hidden ${video ? "bg-slate-950" : "bg-slate-100 p-3 text-slate-500"}`}>
        {video ? <video ref={player => { playerRef.current = player; }} src={asset.fileUrl} controls playsInline preload="none" aria-label={`Preview ${asset.originalName}`} onError={() => setFailed(true)} className="h-full w-full object-contain" />
          : <><Music2 size={30} aria-hidden="true" /><audio ref={player => { playerRef.current = player; }} src={asset.fileUrl} controls preload="none" aria-label={`Preview ${asset.originalName}`} onError={() => setFailed(true)} className="h-10 w-full min-w-0" /></>}
      </div>
      {failed && <p role="status" className="px-3 pt-2 text-xs text-amber-800">This file cannot be previewed in this browser. You can still select it.</p>}
    </>;
  }
  return <Button type="button" variant="ghost" onClick={onSelect} aria-label={`Select ${asset.originalName}`} className="relative block aspect-[16/10] h-auto w-full overflow-hidden rounded-none bg-slate-100 p-0">
    {asset.contentType.startsWith("image/") ? <Image src={asset.fileUrl} alt="" fill unoptimized sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="object-cover" />
      : <span className="grid h-full place-items-center text-slate-500"><FileDown size={30} aria-hidden="true" /></span>}
  </Button>;
}

export function MediaLibraryAssetCard({ asset, onSelect, onDelete, busy, deleting }: {
  asset: MediaLibraryAsset; onSelect: () => void; onDelete: () => void; busy: boolean; deleting: boolean;
}) {
  const created = new Date(asset.createdAt);
  return <article data-media-asset-id={asset.id} className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-colors hover:border-indigo-400">
    <MediaPreview key={asset.fileUrl} asset={asset} onSelect={onSelect} />
    <div className="flex flex-1 flex-col gap-2 p-3">
      <p title={asset.originalName} className="truncate text-sm font-medium text-slate-800">{asset.originalName}</p>
      <p className="text-xs text-slate-500">{mediaFileTypeLabel(asset.contentType)} · {formatMediaSize(asset.size)}</p>
      {!Number.isNaN(created.getTime()) && <time dateTime={asset.createdAt} className="text-xs text-slate-500">{created.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</time>}
      <div className="mt-auto flex items-center gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={onSelect} aria-label={`Use ${asset.originalName}`} className="min-w-0 flex-1">Use file</Button>
        <Button type="button" variant="ghost" size="icon" aria-label={`Delete ${asset.originalName}`} title="Delete media" disabled={busy} onClick={onDelete} className="size-8 shrink-0 text-slate-500 hover:bg-rose-50 hover:text-rose-700">
          {deleting ? <LoaderCircle size={15} className="animate-spin" /> : <Trash2 size={15} />}
        </Button>
      </div>
    </div>
  </article>;
}
