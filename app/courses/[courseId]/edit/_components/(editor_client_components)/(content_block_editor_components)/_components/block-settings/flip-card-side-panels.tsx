"use client";

import { useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { FlipCardSide } from "../content-block-types";

const sides = ["front", "back"] as const;

export function FlipCardSidePanels({ index, children }: { index: number; children: (side: FlipCardSide) => ReactNode }) {
  const id = useId();
  const [active, setActive] = useState<FlipCardSide>("front");
  return <div className="min-w-0 space-y-3">
    <div role="tablist" aria-label={`Card ${index + 1} sides`} className="grid grid-cols-2 gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1">
      {sides.map((side, position) => <Button key={side} role="tab" id={`${id}-${side}-tab`} aria-controls={`${id}-${side}-panel`} aria-selected={active === side} tabIndex={active === side ? 0 : -1} variant="ghost" size="sm" className="min-w-0 px-2 text-xs aria-selected:bg-white aria-selected:text-indigo-700 aria-selected:shadow-sm" onClick={() => setActive(side)} onKeyDown={(event) => {
        const next = event.key === "ArrowLeft" || event.key === "ArrowRight" ? 1 - position : event.key === "Home" ? 0 : event.key === "End" ? 1 : null;
        if (next === null) return;
        event.preventDefault();
        event.stopPropagation();
        setActive(sides[next]);
        document.getElementById(`${id}-${sides[next]}-tab`)?.focus();
      }}>{side === "front" ? "Front" : "Back"}</Button>)}
    </div>
    {sides.map((side) => <div key={side} role="tabpanel" id={`${id}-${side}-panel`} aria-labelledby={`${id}-${side}-tab`} hidden={active !== side}>{children(side)}</div>)}
  </div>;
}
