"use client";

import type { ContentBlock } from "@/lib/schemas/block";
import { blockImageInstructions, type BlockImageMedia } from "@/lib/editor/block-image";
import { ContentImageDialog } from "./process-step-image-dialog";

export function BlockImageDialog({ block, courseId, onClose, onSelect }: {
  block: ContentBlock; courseId: string; onClose: () => void; onSelect: (media: BlockImageMedia) => void;
}) {
  return <ContentImageDialog source="block" title="" instructions={blockImageInstructions(block)} dialogTitle="Generate image for block" courseId={courseId} onClose={onClose} onSelect={onSelect} />;
}
