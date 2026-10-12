"use client";

import { useEffect, useState } from "react";
import { Settings2 } from "lucide-react";
import type { ContentBlock } from "@/lib/schemas/block";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const spacingOptions = [
  { value: "none", label: "None" },
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
] as const;
const backgroundColors = ["#ffffff", "#f1f5f9", "#dbeafe", "#bfdbfe", "#dcfce7", "#bbf7d0", "#fef3c7", "#fde68a", "#fee2e2", "#fecaca", "#ede9fe", "#1e293b"];

export function BlockFormatMenu({ block, onChange }: { block: ContentBlock; onChange: (block: ContentBlock) => void }) {
  const [colorCode, setColorCode] = useState(block.backgroundColor);

  useEffect(() => setColorCode(block.backgroundColor), [block.backgroundColor]);

  function changeColorCode(value: string) {
    setColorCode(value);
    const normalized = value.startsWith("#") ? value : `#${value}`;
    if (/^#[\da-fA-F]{6}$/.test(normalized)) onChange({ ...block, backgroundColor: normalized.toLowerCase() });
  }

  return <details className="relative">
    <summary aria-label="Format block" title="Format" className="grid size-8 cursor-pointer list-none place-items-center rounded-md text-slate-500 hover:bg-indigo-50 hover:text-indigo-700 [&::-webkit-details-marker]:hidden"><Settings2 size={15} /></summary>
    <div className="absolute right-0 z-40 mt-1 w-64 space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-slate-700 shadow-xl">
      <h3 className="text-sm font-semibold">Format</h3>
      <label className="block text-xs font-medium">Content width
        <Select aria-label="Content width" value={block.widthCustom ? block.width : "small"} onChange={(event) => onChange({ ...block, width: event.target.value as ContentBlock["width"], widthCustom: true })} className="mt-1 h-9 w-full text-xs"><option value="full">L - 920px</option><option value="medium">M - 720px</option><option value="small">S - 520px</option></Select>
      </label>
      <div>
        <label htmlFor={`block-background-${block.id}`} className="block text-xs font-medium">Background color</label>
        <div className="mt-1 flex items-center gap-2">
          <input id={`block-background-${block.id}`} type="color" aria-label="Choose background color" value={block.backgroundColor} onChange={(event) => onChange({ ...block, backgroundColor: event.target.value })} className="size-9 cursor-pointer rounded-md border border-slate-200 bg-white p-1" />
          <Input aria-label="Background color hex code" value={colorCode} maxLength={7} onChange={(event) => changeColorCode(event.target.value)} onBlur={() => {
            const normalized = colorCode.startsWith("#") ? colorCode : `#${colorCode}`;
            if (/^#[\da-fA-F]{6}$/.test(normalized)) {
              const color = normalized.toLowerCase();
              setColorCode(color);
              onChange({ ...block, backgroundColor: color });
            } else setColorCode(block.backgroundColor);
          }} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} className="h-9 w-24 font-mono text-xs uppercase" />
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Background color presets">
          {backgroundColors.map((color) => <button key={color} type="button" aria-label={`Set background ${color}`} title={color} onClick={() => onChange({ ...block, backgroundColor: color })} className={`size-6 rounded-md border ${block.backgroundColor.toLowerCase() === color ? "border-indigo-600 ring-1 ring-indigo-500" : "border-slate-200"}`} style={{ backgroundColor: color }} />)}
        </div>
        <p className="mt-1 text-[11px] text-slate-500">Text color adjusts for contrast.</p>
      </div>
      <label className="block text-xs font-medium">Block padding
        <Select aria-label="Block padding" value={block.blockPadding ?? "medium"} onChange={(event) => onChange({ ...block, blockPadding: event.target.value as ContentBlock["blockPadding"] })} className="mt-1 h-9 w-full text-xs">{spacingOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select>
      </label>
      {block.type === "heading" && <label className="block text-xs font-medium">Heading padding
        <Select aria-label="Heading padding" value={block.headingPadding ?? "none"} onChange={(event) => onChange({ ...block, headingPadding: event.target.value as ContentBlock["headingPadding"] })} className="mt-1 h-9 w-full text-xs">{spacingOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select>
      </label>}
      <div className="border-t border-slate-100 pt-2">
        <label className="block text-xs font-medium text-slate-400">Audio position
          <Select aria-label="Audio position" disabled className="mt-1 h-9 w-full text-xs"><option>Audio block not available</option></Select>
        </label>
      </div>
    </div>
  </details>;
}
