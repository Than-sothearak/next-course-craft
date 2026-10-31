"use client";

import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SlidePresentationContextValue } from "./slide-presentation-context";

export function SlideCanvasMenu({ menuOpen, onMenuOpenChange, menu }: Pick<SlidePresentationContextValue, "menuOpen" | "onMenuOpenChange" | "menu">) {
  return <>
    <Button type="button" variant="ghost" size="icon" aria-label={menuOpen ? "Close slide menu" : "Open slide menu"} aria-expanded={menuOpen} aria-controls="slide-course-menu" onClick={() => onMenuOpenChange(!menuOpen)} className="absolute left-3 top-3 z-30 size-8 bg-white/90 text-slate-700 shadow-sm hover:bg-white"><Menu size={16} /></Button>
    {menuOpen && <div id="slide-course-menu" className="absolute inset-0 z-40 flex">
      <button type="button" aria-label="Close slide menu overlay" onClick={() => onMenuOpenChange(false)} className="absolute inset-0 cursor-pointer bg-slate-950/45" />
      {menu}
    </div>}
  </>;
}
