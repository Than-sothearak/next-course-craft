"use client";

import type { ContentBlock } from "@/lib/schemas/block";
import { ProcessStepsSettings } from "../../process-steps-settings";

export function ProcessStepsBlockSettings({ block, onChange, courseId }: { block: Extract<ContentBlock, { type: "processSteps" }>; onChange: (block: ContentBlock) => void; courseId: string }) {
  return (
    <ProcessStepsSettings block={block} courseId={courseId} onChange={onChange} />
  );
}
