"use client";

import { AlignHorizontalJustifyCenter, AlignHorizontalJustifyEnd, AlignHorizontalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, AlignVerticalJustifyStart, PanelTop } from "lucide-react";
import { Button } from "@/components/ui/button";
import { alignSlideObjectFrame, type SlideAlignment, type SlideAlignmentLines } from "@/lib/editor/slide-alignment";
import { resolveSlideFrame, type SlideSize } from "@/lib/editor/slide-design";
import type { ContentBlock } from "@/lib/schemas/block";

const alignments = [
  { id: "left", label: "Left", icon: AlignHorizontalJustifyStart },
  { id: "center", label: "Center", icon: AlignHorizontalJustifyCenter },
  { id: "right", label: "Right", icon: AlignHorizontalJustifyEnd },
  { id: "top", label: "Top", icon: AlignVerticalJustifyStart },
  { id: "middle", label: "Middle", icon: AlignVerticalJustifyCenter },
  { id: "bottom", label: "Bottom", icon: AlignVerticalJustifyEnd },
] as const;

export function SlideObjectAlignmentControls({ block, index, total, area, headerBottom, footerTop, onChange }: SlideAlignmentLines & {
  block: ContentBlock; index: number; total: number; area: SlideSize; onChange: (block: ContentBlock) => void;
}) {
  function align(alignment: SlideAlignment) {
    const frame = resolveSlideFrame(block, index, total, area);
    onChange({ ...block, slideFrame: alignSlideObjectFrame(frame, alignment, area, { headerBottom, footerTop }) });
  }
  return <div className="space-y-2" role="group" aria-label="Object alignment">
    <p className="text-xs font-medium text-slate-600">Align to canvas</p>
    <div className="grid grid-cols-3 gap-1.5">{alignments.map(({ id, label, icon: Icon }) => <Button key={id} type="button" variant="outline" size="sm" aria-label={`Align object ${id}`} onClick={() => align(id)} className="gap-1 px-1 text-[11px]"><Icon size={13} aria-hidden="true" />{label}</Button>)}</div>
    <div className="flex gap-2">
      {headerBottom !== undefined && <Button type="button" variant="outline" size="sm" className="min-w-0 flex-1 px-2 text-xs" onClick={() => align("header")}><PanelTop size={13} aria-hidden="true" />Align to header</Button>}
      {footerTop !== undefined && <Button type="button" variant="outline" size="sm" className="min-w-0 flex-1 px-2 text-xs" onClick={() => align("footer")}><AlignVerticalJustifyEnd size={13} aria-hidden="true" />Align to footer</Button>}
    </div>
  </div>;
}
