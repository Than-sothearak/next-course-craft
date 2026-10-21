"use client";

import type { ContentBlock } from "@/lib/schemas/block";
import { Button } from "@/components/ui/button";
import type { MediaLibraryTarget } from "../content-block-types";
import type { Dispatch, SetStateAction } from "react";

export function AttachmentBlockSettings({ setMediaLibraryTarget, block }: { setMediaLibraryTarget: Dispatch<SetStateAction<MediaLibraryTarget | null>>; block: Extract<ContentBlock, { type: "attachment" }> }) {
  return (
    <div className="space-y-2">
      <p className="text-xs leading-5 text-slate-500">Upload PDF, Word, PowerPoint, or any other file up to 250 MB. Learners download attachments from the lesson.</p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setMediaLibraryTarget("attachment")}
      >
        Choose or upload file
      </Button>
      {block.data.fileName && <p className="truncate text-xs text-slate-600">Selected: {block.data.fileName}</p>}
    </div>
  );
}
