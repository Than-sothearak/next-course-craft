"use client";

import { Checkbox } from "@/components/ui/checkbox";
import type { ContentBlock } from "@/lib/schemas/block";

export function MediaSkippingControls({ block, onChange }: {
  block: Extract<ContentBlock, { type: "audio" | "video" }>;
  onChange: (block: ContentBlock) => void;
}) {
  const allowed = block.allowSkipping !== false;
  return <label className="relative flex cursor-pointer items-center justify-between gap-3 rounded-md border border-slate-200 p-3">
    <span className="min-w-0">
      <span className="block text-xs font-medium text-slate-700">Allow skipping</span>
      <span className="mt-1 block text-[11px] leading-4 text-slate-500">{allowed ? "Learners can seek to any point." : "Learners can replay played sections. Skipping ahead unlocks after full playback."}</span>
    </span>
    <Checkbox role="switch" aria-label="Allow skipping" checked={allowed} onChange={(event) => onChange({ ...block, allowSkipping: event.target.checked })} className="peer sr-only" />
    <span aria-hidden="true" className="relative h-5 w-9 shrink-0 rounded-full bg-slate-200 transition-colors after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:bg-indigo-600 peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500 peer-focus-visible:ring-offset-2" />
  </label>;
}
