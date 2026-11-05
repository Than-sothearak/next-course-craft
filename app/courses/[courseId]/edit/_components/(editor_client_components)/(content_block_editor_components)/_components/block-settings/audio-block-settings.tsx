"use client";

import type { Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { MediaSkippingControls } from "@/components/media-skipping-controls";
import type { ContentBlock } from "@/lib/schemas/block";
import type { MediaLibraryTarget } from "../content-block-types";

export function AudioBlockSettings({ block, setMediaLibraryTarget, onChange }: {
  block: Extract<ContentBlock, { type: "audio" }>;
  setMediaLibraryTarget: Dispatch<SetStateAction<MediaLibraryTarget | null>>;
  onChange: (block: ContentBlock) => void;
}) {
  return (
    <div className="space-y-2">
      <MediaSkippingControls block={block} onChange={onChange} />
      <p className="text-xs leading-5 text-slate-500">Upload MP3, M4A, OGG, WAV, or WebM audio up to 100 MB.</p>
      <Button type="button" variant="outline" size="sm" onClick={() => setMediaLibraryTarget("audio")}>
        Choose or upload audio
      </Button>
      {block.data.fileName && <p className="break-all text-xs text-slate-600">Selected: {block.data.fileName}</p>}
    </div>
  );
}
