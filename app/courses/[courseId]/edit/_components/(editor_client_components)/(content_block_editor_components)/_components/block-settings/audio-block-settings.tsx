"use client";

import type { Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import type { ContentBlock } from "@/lib/schemas/block";
import type { MediaLibraryTarget } from "../content-block-types";

export function AudioBlockSettings({ block, setMediaLibraryTarget }: {
  block: Extract<ContentBlock, { type: "audio" }>;
  setMediaLibraryTarget: Dispatch<SetStateAction<MediaLibraryTarget | null>>;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs leading-5 text-slate-500">Upload MP3, M4A, OGG, WAV, or WebM audio up to 100 MB.</p>
      <Button type="button" variant="outline" size="sm" onClick={() => setMediaLibraryTarget("audio")}>
        Choose or upload audio
      </Button>
      {block.data.fileName && <p className="break-all text-xs text-slate-600">Selected: {block.data.fileName}</p>}
    </div>
  );
}
