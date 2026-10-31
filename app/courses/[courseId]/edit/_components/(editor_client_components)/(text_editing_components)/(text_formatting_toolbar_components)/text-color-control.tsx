"use client";

import { useContext, useLayoutEffect, useRef, useState } from "react";
import { Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ColorPicker, GradientColorContext } from "@/components/ui/color-picker";
import { colorValueSchema, parseGradient } from "@/lib/color";
import type { Editor } from "@tiptap/core";
import { normalizeHexColor } from "@/lib/editor/text-format";
import { setInlineStyle } from "./text-formatting-commands";

const textColors = ["#111827", "#475569", "#2563eb", "#7c3aed", "#b91c1c", "#b45309", "#15803d", "#0891b2"];
export function TextColorControl({ editor, selectedColor }: { editor: Editor; selectedColor: string }) {
  const [colorInput, setColorInput] = useState(selectedColor);
  const [colorTab, setColorTab] = useState<"presets" | "wheel">("presets");
  const presentation = useContext(GradientColorContext);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, width: 256 });
  const customColor = colorValueSchema.safeParse(colorInput).success ? colorInput : normalizeHexColor(colorInput);

  useLayoutEffect(() => {
    const details = detailsRef.current;
    const inspector = details?.closest<HTMLElement>("[data-slide-inspector]");
    if (!open || !presentation || !details || !inspector) return;
    const measure = () => {
      const anchor = details.getBoundingClientRect();
      const bounds = inspector.getBoundingClientRect();
      if (!bounds.width) return;
      const width = Math.min(256, Math.max(180, bounds.width - 24));
      const left = Math.max(bounds.left + 12 - anchor.left, Math.min(0, bounds.right - 12 - anchor.left - width));
      setPosition((current) => current.left === left && current.width === width ? current : { left, width });
    };
    measure();
    window.addEventListener("resize", measure);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(inspector);
    return () => { window.removeEventListener("resize", measure); observer?.disconnect(); };
  }, [open, presentation]);

  function applyColor(color: string) {
    setColorInput(color);
    setInlineStyle(editor, "color", color);
  }

  return <details ref={detailsRef} onToggle={(event) => setOpen(event.currentTarget.open)} className="relative">
    <summary aria-label="Text color" title="Text color" className="relative grid size-8 cursor-pointer list-none place-items-center rounded-md text-slate-600 hover:bg-slate-100 [&::-webkit-details-marker]:hidden"><Palette size={16} /><span className="absolute bottom-1 left-1/2 size-2.5 -translate-x-1/2 rounded-[2px] border border-white" style={{ background: selectedColor }} /></summary>
    <div style={presentation ? position : undefined} className="absolute left-0 top-full z-50 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-3 text-slate-700 shadow-xl">
      <div className="mb-3 flex gap-1 border-b border-slate-100 pb-2" role="group" aria-label="Color picker tabs">
        <Button type="button" variant={colorTab === "presets" ? "secondary" : "ghost"} size="sm" aria-pressed={colorTab === "presets"} onMouseDown={(event) => event.preventDefault()} onClick={() => setColorTab("presets")} className="h-7 flex-1 text-xs">Presets</Button>
        <Button type="button" variant={colorTab === "wheel" ? "secondary" : "ghost"} size="sm" aria-pressed={colorTab === "wheel"} onMouseDown={(event) => event.preventDefault()} onClick={() => setColorTab("wheel")} className="h-7 flex-1 text-xs">Color wheel</Button>
      </div>
      {colorTab === "presets" ? <div className="grid grid-cols-4 gap-1.5" aria-label="Text color presets">
        {textColors.map((color) => <button key={color} type="button" title={`Text color ${color}`} aria-label={`Text color ${color}`} onMouseDown={(event) => event.preventDefault()} onClick={() => applyColor(color)} className={`cursor-pointer grid size-9 place-items-center rounded-md border ${selectedColor === color ? "border-indigo-600 ring-1 ring-indigo-500" : "border-slate-200 hover:bg-slate-100"}`}><span className="size-5 rounded-[3px] border border-slate-200" style={{ backgroundColor: color }} /></button>)}
      </div> : <div role="group" aria-label="Color wheel and color code" className="space-y-3">
        <ColorPicker aria-label="Choose text color" hexLabel="Text color hex code" value={parseGradient(colorInput) ? colorInput : normalizeHexColor(colorInput) ?? selectedColor} onChange={setColorInput} />
        <Button type="button" size="sm" disabled={!customColor} onMouseDown={(event) => event.preventDefault()} onClick={() => { if (customColor) applyColor(customColor); }} className="w-full">Apply color</Button>
        {!customColor && <p role="alert" className="text-[11px] text-rose-700">Enter a valid 3 or 6 digit hex color.</p>}
      </div>}
    </div>
  </details>;
}

