"use client";

import type { ContentBlock } from "@/lib/schemas/block";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MediaSkippingControls } from "@/components/media-skipping-controls";
import type { MediaLibraryTarget } from "../content-block-types";
import type { Dispatch, SetStateAction } from "react";

export function VideoBlockSettings({ setMediaLibraryTarget, block, onChange }: { setMediaLibraryTarget: Dispatch<SetStateAction<MediaLibraryTarget | null>>; block: Extract<ContentBlock, { type: "video" }>; onChange: (block: ContentBlock) => void }) {
  return (
    <div className="space-y-2">
      <MediaSkippingControls block={block} onChange={onChange} />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setMediaLibraryTarget("video")}
      >
        Choose from media library
      </Button>
      <Input
        aria-label="Video URL"
        type="url"
        value={block.data.src}
        onChange={(event) => {
          const data = { ...block.data, src: event.target.value };
          delete data.mimeType;
          onChange({ ...block, data });
        }}
        placeholder="Video URL"
        className="h-9"
      />
      <p className="text-xs leading-5 text-slate-500">
        Required video progress is recorded when a browser-playable video file finishes. External video pages open separately and cannot report when playback ends.
      </p>
      <Input
        aria-label="Captions URL (optional)"
        type="url"
        value={block.data.captions ?? ""}
        onChange={(event) =>
          onChange({
            ...block,
            data: { ...block.data, captions: event.target.value },
          })
        }
        placeholder="Captions URL (optional)"
        className="h-9"
      />
    </div>
  );
}
