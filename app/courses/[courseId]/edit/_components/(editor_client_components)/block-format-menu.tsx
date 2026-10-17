"use client";

import { useEffect, useRef, useState } from "react";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  defaultBlockPaddingForBlock,
  defaultBlockWidthForBlock,
  type ContentBlock,
} from "@/lib/schemas/block";
import { DraggableSettingsPanel } from "./draggable-settings-panel";

const spacingOptions = [
  { value: "none", label: "None" },
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
] as const;
const blockPaddingOptions = [0, 20, 40, 60, 80, 100, 120] as const;
const backgroundColors = ["#ffffff", "#f1f5f9", "#dbeafe", "#bfdbfe", "#dcfce7", "#bbf7d0", "#fef3c7", "#fde68a", "#fee2e2", "#fecaca", "#ede9fe", "#1e293b"];

export function BlockFormatMenu({ block, onChange }: { block: ContentBlock; onChange: (block: ContentBlock) => void }) {
  const [colorCode, setColorCode] = useState(block.backgroundColor);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = `block-format-${block.id}`;

  // Keep editable drafts in sync when an external edit or undo changes the block.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setColorCode(block.backgroundColor), [block.backgroundColor]);

  useEffect(() => {
    if (!open) return;

    function closeOnOutsidePointerDown(event: PointerEvent) {
      const target = event.target;
      if (
        !(target instanceof Node) ||
        triggerRef.current?.contains(target) ||
        document.getElementById(panelId)?.contains(target)
      )
        return;
      setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener("pointerdown", closeOnOutsidePointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, panelId]);

  function changeColorCode(value: string) {
    setColorCode(value);
    const normalized = value.startsWith("#") ? value : `#${value}`;
    if (/^#[\da-fA-F]{6}$/.test(normalized)) onChange({ ...block, backgroundColor: normalized.toLowerCase() });
  }

  return <>
    <Button
      ref={triggerRef}
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Format block"
      aria-expanded={open}
      aria-controls={panelId}
      onClick={() => {
        if (open) {
          setOpen(false);
        } else {
          setOpen(true);
        }
      }}
      className="size-8 text-slate-500 hover:bg-indigo-50 hover:text-indigo-700"
    >
      <Settings2 size={15} />
    </Button>
    {open && (
      <DraggableSettingsPanel
        id={panelId}
        title="Block format settings"
        side="right"
        panelClassName="w-[min(256px,calc(100vw-3rem))]"
        bodyClassName="space-y-3"
      >
        <h3 className="sr-only">Format</h3>
        <label className="block text-xs font-medium">Content width
          <Select aria-label="Content width" value={block.widthCustom ? block.width : defaultBlockWidthForBlock(block)} onChange={(event) => onChange({ ...block, width: event.target.value as ContentBlock["width"], widthCustom: true })} className="mt-1 h-9 w-full text-xs"><option value="full">L - 920px</option><option value="medium">M - 720px</option><option value="small">S - 520px</option></Select>
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
            {backgroundColors.map((color) => <button key={color} type="button" aria-label={`Set background ${color}`} title={color} onClick={() => onChange({ ...block, backgroundColor: color })} className={`cursor-pointer size-6 rounded-md border ${block.backgroundColor.toLowerCase() === color ? "border-indigo-600 ring-1 ring-indigo-500" : "border-slate-200"}`} style={{ backgroundColor: color }} />)}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Text color adjusts for contrast.</p>
        </div>
        <label className="block text-xs font-medium">Block padding
          <Select aria-label="Block padding" value={String(block.blockPadding ?? defaultBlockPaddingForBlock(block))} onChange={(event) => onChange({ ...block, blockPadding: Number(event.target.value) })} className="mt-1 h-9 w-full text-xs">
            {block.blockPadding !== undefined && !blockPaddingOptions.includes(block.blockPadding as typeof blockPaddingOptions[number]) && <option value={block.blockPadding}>{block.blockPadding} px</option>}
            {blockPaddingOptions.map((padding) => <option key={padding} value={padding}>{padding} px</option>)}
          </Select>
        </label>
        {block.type === "heading" && <label className="block text-xs font-medium">Heading padding
          <Select aria-label="Heading padding" value={block.headingPadding ?? "none"} onChange={(event) => onChange({ ...block, headingPadding: event.target.value as ContentBlock["headingPadding"] })} className="mt-1 h-9 w-full text-xs">{spacingOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select>
        </label>}
        <div className="border-t border-slate-100 pt-2">
          <label className="block text-xs font-medium text-slate-400">Audio position
            <Select aria-label="Audio position" disabled className="mt-1 h-9 w-full text-xs"><option>Audio block not available</option></Select>
          </label>
        </div>
      </DraggableSettingsPanel>
    )}
  </>;
}
