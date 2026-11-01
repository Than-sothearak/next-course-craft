"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { getInteractiveBlockProgressIds } from "@/lib/export/progress";
import type { ContentBlock } from "@/lib/schemas/block";

export function SlideProgressControls({ block, onChange }: { block: ContentBlock; onChange: (block: ContentBlock) => void }) {
  const activity = getInteractiveBlockProgressIds(block).length > 0;
  const continueButton = block.type === "divider" && block.data.style === "continue";
  const required = block.requiredForProgress !== false;
  return <div className="space-y-2" aria-label="Object progress settings">
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-slate-200 p-3">
      <span className="min-w-0"><span className="block text-xs font-medium text-slate-700">Required for progress</span><span className="mt-1 block text-[11px] leading-4 text-slate-500">{required ? "Required" : "Optional"}</span></span>
      <Checkbox role="switch" aria-label="Required for progress" checked={required} onChange={(event) => onChange({ ...block, requiredForProgress: event.target.checked })} className="peer sr-only" />
      <span aria-hidden="true" className="relative h-5 w-9 shrink-0 rounded-full bg-slate-200 transition-colors after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:bg-indigo-600 peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500 peer-focus-visible:ring-offset-2" />
    </label>
    <p className="text-xs leading-5 text-slate-500">{activity
      ? required ? "Learners must complete this activity before continuing in Restricted navigation." : "Learners can skip this activity. It does not block navigation or reduce slide completion."
      : continueButton ? required ? "Continue keeps its content-reveal and activity requirements." : "This Continue button is optional. Following content is visible and navigation stays unlocked."
      : "This object has no separate activity to complete. It is read with the slide."}</p>
    <p className="text-[11px] leading-4 text-slate-400">Set Navigation &amp; Progress to Restricted to enforce required activities.</p>
  </div>;
}
