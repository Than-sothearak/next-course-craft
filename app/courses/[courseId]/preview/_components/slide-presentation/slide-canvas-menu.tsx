"use client";

import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SlidePresentationContextValue } from "./slide-presentation-context";

export function SlideCanvasMenu({ menuOpen, onMenuOpenChange, menu }: Pick<SlidePresentationContextValue, "menuOpen" | "onMenuOpenChange" | "menu">) {
  return <>
    <Button type="button" variant="ghost" size="icon" aria-label={menuOpen ? "Close slide menu" : "Open slide menu"} aria-expanded={menuOpen} aria-controls="slide-course-menu" onClick={() => onMenuOpenChange(!menuOpen)} className="absolute left-3 top-7 z-30 size-9 text-current hover:bg-black/10"><Menu size={19} /></Button>
    {menuOpen && <div id="slide-course-menu" className="absolute inset-0 z-40 flex">
      <button type="button" aria-label="Close slide menu overlay" onClick={() => onMenuOpenChange(false)} className="absolute inset-0 cursor-pointer bg-slate-950/45" />
      {menu}
    </div>}
  </>;
}
