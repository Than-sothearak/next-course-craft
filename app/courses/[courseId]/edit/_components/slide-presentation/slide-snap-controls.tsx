"use client";

import { Checkbox } from "@/components/ui/checkbox";

export function SlideSnapControls({ enabled, onChange, compact = false }: { enabled: boolean; onChange: (enabled: boolean) => void; compact?: boolean }) {
  return <div className={`flex items-center gap-2 text-xs text-slate-500 ${compact ? "shrink-0" : "flex-wrap justify-between"}`}>
    <label title="Hold Alt while dragging for precise placement." className="flex cursor-pointer items-center gap-2 whitespace-nowrap font-medium text-slate-600"><Checkbox aria-label="Snap to guides" checked={enabled} onChange={(event) => onChange(event.target.checked)} />Snap to guides</label>
    {!compact && <span>Hold Alt while dragging for precise placement.</span>}
  </div>;
}
