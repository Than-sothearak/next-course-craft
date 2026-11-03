"use client";

import { InteractiveFlipCard } from "@/app/courses/[courseId]/preview/interactive-blocks";
import type { FlipCardBlock } from "@/lib/editor/flip-cards";

export function SlideFlipCardEditor({ block }: { block: FlipCardBlock }) {
  return (
    <div data-slide-flip-card-editor className="h-full min-h-0 w-full">
      <InteractiveFlipCard blockId={block.id} {...block.data} presentation />
    </div>
  );
}
