"use client";

import { createContext, useContext, useState } from "react";
import { Blend } from "lucide-react";
import { Button } from "./button";
import { Input } from "./input";
import { cn } from "@/lib/utils";
import { gradientColor, parseGradient } from "@/lib/color";
import { normalizeHexColor } from "@/lib/editor/text-format";

export const GradientColorContext = createContext(false);

function HexColorInput({ value, label, onChange }: { value: string; label: string; onChange: (value: string) => void }) {
  const [draft, setDraft] = useState({ source: value, text: value });
  if (draft.source !== value) setDraft({ source: value, text: value });
  const text = draft.source === value ? draft.text : value;
  const reset = () => setDraft({ source: value, text: value });
  const commit = () => { const color = normalizeHexColor(text); if (color) onChange(color); reset(); };
  return <Input aria-label={label} type="text" value={text} spellCheck={false} autoComplete="off" maxLength={7} aria-invalid={!normalizeHexColor(text)} onChange={(event) => {
    const next = event.target.value;
    setDraft({ source: value, text: next });
    if (/^#?[\da-f]{6}$/i.test(next)) { const color = normalizeHexColor(next); if (color) onChange(color); }
  }} onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commit(); } if (event.key === "Escape") { event.preventDefault(); reset(); } }} className="h-8 min-w-0 flex-1 rounded-md px-1.5 font-mono text-[11px] uppercase shadow-none" />;
}

export function ColorPicker({ value, onChange, "aria-label": label, allowGradient, className, id, hexLabel }: {
  value: string;
  onChange: (value: string) => void;
  "aria-label": string;
  allowGradient?: boolean;
  className?: string;
  id?: string;
  hexLabel?: string;
}) {
  const context = useContext(GradientColorContext);
  const gradients = allowGradient ?? context;
  const gradient = parseGradient(value);
  const first = gradient?.start ?? value;
  const update = (start: string, end = gradient?.end ?? "#8b5cf6", angle = gradient?.angle ?? 90) => onChange(gradient ? gradientColor(start, end, angle) : start);
  const swatch = (color: string, ariaLabel: string, change: (color: string) => void, paint = color) => <span data-color-swatch className="relative block size-8 shrink-0 overflow-hidden rounded-[4px] border border-slate-300 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500" style={{ background: paint }}>
    <Input id={ariaLabel === label ? id : undefined} type="color" aria-label={ariaLabel} value={color} onChange={(event) => change(event.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
  </span>;
  return <div data-color-picker data-color-mode={gradient ? "gradient" : "solid"} className={cn("min-w-0 space-y-2", className)}>
    <div className="flex min-w-0 items-center gap-1.5">
      {swatch(first, label, (color) => update(color), value)}
      <HexColorInput value={first} label={hexLabel ?? `${label} hex code`} onChange={(color) => update(color)} />
      {gradients && <Button type="button" variant={gradient ? "secondary" : "ghost"} size="icon" aria-label={`${label} gradient`} aria-pressed={Boolean(gradient)} title={gradient ? "Switch to solid color" : "Switch to gradient"} className="size-7 shrink-0 rounded-md" onMouseDown={(event) => event.preventDefault()} onClick={() => onChange(gradient ? first : gradientColor(first, "#8b5cf6"))}><Blend size={14} aria-hidden="true" /></Button>}
    </div>
    {gradient && <>
      <div className="flex min-w-0 items-center gap-1.5">
        {swatch(gradient.end, `${label} end color`, (color) => update(first, color))}
        <HexColorInput value={gradient.end} label={`${label} end hex code`} onChange={(color) => update(first, color)} />
      </div>
      <label className="flex items-center gap-2 text-[11px] text-slate-500">Angle <Input aria-label={`${label} gradient angle`} type="number" min={0} max={360} step={1} value={gradient.angle} className="h-7 min-w-0 flex-1 rounded-md px-2 text-xs shadow-none" onChange={(event) => { const angle = event.target.valueAsNumber; if (Number.isInteger(angle) && angle >= 0 && angle <= 360) update(first, gradient.end, angle); }} /><span>°</span></label>
    </>}
  </div>;
}
