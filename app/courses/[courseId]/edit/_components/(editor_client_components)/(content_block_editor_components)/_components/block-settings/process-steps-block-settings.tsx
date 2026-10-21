"use client";

import type { ContentBlock } from "@/lib/schemas/block";
import { ProcessStepsSettings } from "../../process-steps-settings";

export function ProcessStepsBlockSettings({ block, onChange }: { block: Extract<ContentBlock, { type: "processSteps" }>; onChange: (block: ContentBlock) => void }) {
  return (
    <ProcessStepsSettings block={block} onChange={onChange} />
  );
}
