"use client";

import { useContext, useRef, useState } from "react";
import { Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ColorPicker, GradientColorContext } from "@/components/ui/color-picker";
import { colorValueSchema, parseGradient } from "@/lib/color";
import type { Editor } from "@tiptap/core";
import { normalizeHexColor } from "@/lib/editor/text-format";
import { defaultCourseTheme } from "@/lib/editor/theme";
import { Popover } from "@/components/ui/popover";
import { TextFormattingPopupContext } from "../text-formatting-popup-context";
import { setInlineStyle } from "./text-formatting-commands";

const textColors = ["#111827", "#475569", "#2563eb", "#7c3aed", "#b91c1c", "#b45309", "#15803d", "#0891b2"];
export function TextColorControl({ editor, selectedColor }: { editor: Editor; selectedColor: string }) {
  const [colorInput, setColorInput] = useState(selectedColor);
  const [colorTab, setColorTab] = useState<"presets" | "wheel">("presets");
  const presentation = useContext(GradientColorContext);
  const ownerId = useContext(TextFormattingPopupContext);
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [anchorElement, setAnchorElement] = useState<Element | null>(null);
  const [themeColors, setThemeColors] = useState({ primary: defaultCourseTheme.primaryColor, accent: defaultCourseTheme.accentColor });
  const customColor = colorValueSchema.safeParse(colorInput).success ? colorInput : normalizeHexColor(colorInput);

  function applyColor(color: string) {
    setColorInput(color);
    setInlineStyle(editor, "color", color);
  }

  function changeOpen(next: boolean) {
    setOpen(next);
    if (next && !editor.isDestroyed) {
      setAnchorElement(rootRef.current?.closest("[data-text-selection-popup]") ?? null);
      const style = getComputedStyle(editor.view.dom);
      setThemeColors({
        primary: normalizeHexColor(style.getPropertyValue("--course-primary")) ?? defaultCourseTheme.primaryColor,
        accent: normalizeHexColor(style.getPropertyValue("--course-accent")) ?? defaultCourseTheme.accentColor,
      });
    }
  }

  const portalTarget = editor.view.dom.closest("dialog[open]") ?? document.fullscreenElement ?? document.body;
  return <div ref={rootRef}>
    <Popover open={open} onOpenChange={changeOpen} title="Text color" triggerLabel="Text color"
      trigger={<span className="relative grid size-8 place-items-center"><Palette size={16} /><span className="absolute bottom-1 left-1/2 size-2.5 -translate-x-1/2 rounded-[2px] border border-white" style={{ background: selectedColor }} /></span>}
      portalTarget={portalTarget} ownerId={ownerId} layer={110} placement="side"
      anchorElement={anchorElement}>
      <div onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
      <div className="mb-3 flex gap-1 border-b border-slate-100 pb-2" role="group" aria-label="Color picker tabs">
        <Button type="button" variant={colorTab === "presets" ? "secondary" : "ghost"} size="sm" aria-pressed={colorTab === "presets"} onMouseDown={(event) => event.preventDefault()} onClick={() => setColorTab("presets")} className="h-7 flex-1 text-xs">Presets</Button>
        <Button type="button" variant={colorTab === "wheel" ? "secondary" : "ghost"} size="sm" aria-pressed={colorTab === "wheel"} onMouseDown={(event) => event.preventDefault()} onClick={() => setColorTab("wheel")} className="h-7 flex-1 text-xs">Color wheel</Button>
      </div>
      {colorTab === "presets" ? <>
        <div role="group" aria-label="Theme text colors" className="mb-3 space-y-1.5">
          <p className="text-xs font-medium text-slate-500">Theme colors</p>
          <div className="flex items-center gap-1.5">
            {(["primary", "accent"] as const).map((name) => <Button key={name} type="button" variant="outline" size="icon" title={`Theme ${name}: ${themeColors[name]}`} aria-label={`Text color theme ${name}`} aria-pressed={selectedColor === themeColors[name]} onMouseDown={(event) => event.preventDefault()} onClick={() => applyColor(themeColors[name])} className="size-9 rounded-md"><span className="size-5 rounded-[3px] border border-slate-200" style={{ backgroundColor: themeColors[name] }} /></Button>)}
            <Button type="button" variant="ghost" size="sm" onMouseDown={(event) => event.preventDefault()} onClick={() => setInlineStyle(editor, "color", null)} className="h-9 text-xs">Theme default</Button>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-1.5" aria-label="Text color presets">
        {textColors.map((color) => <button key={color} type="button" title={`Text color ${color}`} aria-label={`Text color ${color}`} onMouseDown={(event) => event.preventDefault()} onClick={() => applyColor(color)} className={`cursor-pointer grid size-9 place-items-center rounded-md border ${selectedColor === color ? "border-indigo-600 ring-1 ring-indigo-500" : "border-slate-200 hover:bg-slate-100"}`}><span className="size-5 rounded-[3px] border border-slate-200" style={{ backgroundColor: color }} /></button>)}
      </div></> : <div role="group" aria-label="Color wheel and color code" className="space-y-3">
        <ColorPicker allowGradient={presentation} aria-label="Choose text color" hexLabel="Text color hex code" value={parseGradient(colorInput) ? colorInput : normalizeHexColor(colorInput) ?? selectedColor} onChange={setColorInput} />
        <Button type="button" size="sm" disabled={!customColor} onMouseDown={(event) => event.preventDefault()} onClick={() => { if (customColor) applyColor(customColor); }} className="w-full">Apply color</Button>
        {!customColor && <p role="alert" className="text-[11px] text-rose-700">Enter a valid 3 or 6 digit hex color.</p>}
      </div>}
      </div>
    </Popover>
  </div>;
}

