"use client";

import { useState } from "react";
import { Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Editor } from "@tiptap/core";
import { normalizeHexColor } from "@/lib/editor/text-format";
import { setInlineStyle } from "./text-formatting-commands";

const textColors = ["#111827", "#475569", "#2563eb", "#7c3aed", "#b91c1c", "#b45309", "#15803d", "#0891b2"];
export function TextColorControl({ editor, selectedColor }: { editor: Editor; selectedColor: string }) {
  const [colorInput, setColorInput] = useState(selectedColor);
  const [colorTab, setColorTab] = useState<"presets" | "wheel">("presets");
  const customColor = normalizeHexColor(colorInput);

  function applyColor(color: string) {
    setColorInput(color);
    setInlineStyle(editor, "color", color);
  }

  return <details className="relative">
    <summary aria-label="Text color" title="Text color" className="relative grid size-8 cursor-pointer list-none place-items-center rounded-md text-slate-600 hover:bg-slate-100 [&::-webkit-details-marker]:hidden"><Palette size={16} /><span className="absolute bottom-1 left-1/2 size-2.5 -translate-x-1/2 rounded-full border border-white" style={{ backgroundColor: selectedColor }} /></summary>
    <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-3 text-slate-700 shadow-xl">
      <div className="mb-3 flex gap-1 border-b border-slate-100 pb-2" role="group" aria-label="Color picker tabs">
        <Button type="button" variant={colorTab === "presets" ? "secondary" : "ghost"} size="sm" aria-pressed={colorTab === "presets"} onMouseDown={(event) => event.preventDefault()} onClick={() => setColorTab("presets")} className="h-7 flex-1 text-xs">Presets</Button>
        <Button type="button" variant={colorTab === "wheel" ? "secondary" : "ghost"} size="sm" aria-pressed={colorTab === "wheel"} onMouseDown={(event) => event.preventDefault()} onClick={() => setColorTab("wheel")} className="h-7 flex-1 text-xs">Color wheel</Button>
      </div>
      {colorTab === "presets" ? <div className="grid grid-cols-4 gap-1.5" aria-label="Text color presets">
        {textColors.map((color) => <button key={color} type="button" title={`Text color ${color}`} aria-label={`Text color ${color}`} onMouseDown={(event) => event.preventDefault()} onClick={() => applyColor(color)} className={`cursor-pointer grid size-9 place-items-center rounded-md border ${selectedColor === color ? "border-indigo-600 ring-1 ring-indigo-500" : "border-slate-200 hover:bg-slate-100"}`}><span className="size-5 rounded-full border border-slate-200" style={{ backgroundColor: color }} /></button>)}
      </div> : <div role="group" aria-label="Color wheel and color code" className="space-y-3">
        <label className="flex items-center justify-between text-xs font-medium">Color wheel<input type="color" aria-label="Choose text color" value={normalizeHexColor(colorInput) ?? selectedColor} onChange={(event) => setColorInput(event.target.value)} className="size-10 cursor-pointer rounded-md border border-slate-200 bg-white p-1" /></label>
        <label className="block text-xs font-medium">Color code<Input aria-label="Text color hex code" value={colorInput} maxLength={7} onChange={(event) => setColorInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && customColor) { event.preventDefault(); applyColor(customColor); } }} className="mt-1 h-9 font-mono text-xs uppercase" /></label>
        <Button type="button" size="sm" disabled={!customColor} onMouseDown={(event) => event.preventDefault()} onClick={() => { if (customColor) applyColor(customColor); }} className="w-full">Apply color</Button>
        {!customColor && <p role="alert" className="text-[11px] text-rose-700">Enter a valid 3 or 6 digit hex color.</p>}
      </div>}
    </div>
  </details>;
}

