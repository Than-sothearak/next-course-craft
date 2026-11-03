"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { getInteractiveBlockProgressIds } from "@/lib/export/progress";
import type { ContentBlock } from "@/lib/schemas/block";

export function BlockProgressControls({
  block,
  onChange,
  lessonBlocks,
}: {
  block: ContentBlock;
  onChange: (block: ContentBlock) => void;
  lessonBlocks?: readonly ContentBlock[];
}) {
  const activity = getInteractiveBlockProgressIds(block, lessonBlocks).length > 0;
  const continueButton = block.type === "divider" && block.data.style === "continue";
  const required = block.requiredForProgress !== false;

  return (
    <div className="space-y-2" aria-label="Object progress settings">
      <label className="relative flex cursor-pointer items-center justify-between gap-3 rounded-md border border-slate-200 p-3">
        <span className="min-w-0">
          <span className="block text-xs font-medium text-slate-700">Required for progress</span>
          <span className="mt-1 block text-[11px] leading-4 text-slate-500">{required ? "Required" : "Optional"}</span>
        </span>
        <Checkbox
          role="switch"
          aria-label="Required for progress"
          checked={required}
          onChange={(event) => onChange({ ...block, requiredForProgress: event.target.checked })}
          className="peer sr-only"
        />
        <span aria-hidden="true" className="relative h-5 w-9 shrink-0 rounded-full bg-slate-200 transition-colors after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:bg-indigo-600 peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500 peer-focus-visible:ring-offset-2" />
      </label>
      <p className="text-xs leading-5 text-slate-500">
        {activity
          ? required
            ? "Learners must complete this activity to earn full lesson progress. Restricted navigation also uses it to gate forward progress."
            : "This activity does not count toward lesson completion or block navigation."
          : continueButton
            ? required
              ? "This Continue button remains part of lesson completion and keeps its content and activity gates."
              : "This Continue button is optional; following content stays available and it does not block completion."
            : "This object has no separate activity to complete. It is measured through reading progress."}
      </p>
    </div>
  );
}
