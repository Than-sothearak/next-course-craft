"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { slideSelectionUnits } from "@/lib/editor/slide-selection";
import type { ContentBlock } from "@/lib/schemas/block";
import type { SlideSelection } from "./use-slide-selection";

export function SlideSelectionControls({ selection, blocks }: { selection: SlideSelection; blocks: ContentBlock[] }) {
  const [target, setTarget] = useState("selection");
  if (!selection.selectedIds.length) return null;
  const count = slideSelectionUnits(blocks).filter((unit) => unit.blocks.some((block) => selection.selectedIds.includes(block.id))).length;
  const grouped = blocks.some((block) => selection.selectedIds.includes(block.id) && block.slideGroupId);
  return <section aria-label="Selection tools" className="space-y-2 rounded-lg border border-indigo-200 bg-indigo-50/50 p-2">
    <p role="status" className="text-xs font-semibold text-slate-700">{selection.selectedIds.length} object{selection.selectedIds.length === 1 ? "" : "s"} selected{selection.memberGroupId ? " · Editing group member" : ""}</p>
    {!selection.editable && <p className="text-xs text-slate-500">Unlock or show this layer to edit it.</p>}
    <div className="flex flex-wrap gap-1">
      <Button variant="outline" size="sm" disabled={!selection.editable || count < 2 || Boolean(selection.memberGroupId)} onClick={selection.group}>Group</Button>
      <Button variant="outline" size="sm" disabled={!selection.editable || !grouped} onClick={selection.ungroup}>Ungroup</Button>
      <Button variant="outline" size="sm" disabled={!selection.editable} onClick={selection.duplicate}>Duplicate selection</Button>
      <Button variant="outline" size="sm" disabled={!selection.editable} onClick={selection.remove}>Delete selection</Button>
    </div>
    {selection.selectedIds.length > 1 && <>
      <Select aria-label="Selection alignment target" value={target} onChange={(event) => setTarget(event.target.value)}><option value="selection">Align to selection</option><option value="canvas">Align to canvas</option></Select>
      <div role="group" aria-label="Selection alignment" className="grid grid-cols-3 gap-1">
        {(["left", "center", "right", "top", "middle", "bottom"] as const).map((alignment) => <Button key={alignment} variant="outline" size="sm" className="px-1 text-xs capitalize" aria-label={`Align selection ${alignment}`} disabled={!selection.editable || count < 2} onClick={() => selection.align(alignment, target === "canvas")}>{alignment}</Button>)}
      </div>
      <div className="flex gap-1">
        <Button variant="outline" size="sm" className="min-w-0 flex-1 px-1 text-xs" disabled={!selection.canDistribute("x")} onClick={() => selection.distribute("x")}>Space horizontally</Button>
        <Button variant="outline" size="sm" className="min-w-0 flex-1 px-1 text-xs" disabled={!selection.canDistribute("y")} onClick={() => selection.distribute("y")}>Space vertically</Button>
      </div>
    </>}
  </section>;
}
