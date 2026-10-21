"use client";

import type { ContentBlock } from "@/lib/schemas/block";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MediaLibraryTarget } from "../content-block-types";
import type { Dispatch, SetStateAction } from "react";

export function VideoBlockSettings({ setMediaLibraryTarget, block, onChange }: { setMediaLibraryTarget: Dispatch<SetStateAction<MediaLibraryTarget | null>>; block: Extract<ContentBlock, { type: "video" }>; onChange: (block: ContentBlock) => void }) {
  return (
    <div className="space-y-2">
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
