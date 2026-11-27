"use client";

import type { Editor } from "@tiptap/core";
import { NumberInput } from "@/components/ui/number-input";
import { Select } from "@/components/ui/select";
import { setFontSize } from "./text-formatting-commands";
import { useSelectionFontSize } from "./use-selection-font-size";

const fontSizes = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 40, 44, 48, 56, 64, 72, 96, 120, 144, 160, 180, 200];

export function FontSizeControl({ editor, selectedFontSize }: { editor: Editor; selectedFontSize: string | null }) {
  const inheritedSize = useSelectionFontSize(editor);
  const size = selectedFontSize ? Number.parseFloat(selectedFontSize) : inheritedSize;
  const currentSize = size ?? 16;
  const currentPreset = size === null ? "" : `${size}px`;
  return <>
    <Select aria-label="Font size preset" value={currentPreset} onChange={(event) => setFontSize(editor, event.target.value || null, false)} className="h-8 w-[5.25rem] rounded-md border-slate-200 px-2 text-xs shadow-none">
      {size !== null && !fontSizes.includes(size) && <option value={currentPreset}>{size} px</option>}
      <option value="">Default</option>{fontSizes.map((size) => <option key={size} value={`${size}px`}>{size} px</option>)}
    </Select>
    <NumberInput aria-label="Custom font size in pixels" min={Math.min(8, currentSize)} max={Math.max(200, currentSize)} precision="any" value={currentSize} onValueChange={(value) => setFontSize(editor, `${Math.max(8, Math.min(200, Math.round(value)))}px`, false)} className="h-8 w-[5.25rem] rounded-md text-xs" />
  </>;
}

