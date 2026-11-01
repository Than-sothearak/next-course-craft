"use client";

import type { Editor } from "@tiptap/core";
import { NumberInput } from "@/components/ui/number-input";
import { Select } from "@/components/ui/select";
import { setFontSize } from "./text-formatting-commands";

const fontSizes = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 40, 44, 48, 56, 64, 72, 96, 120, 144, 160, 180, 200];

export function FontSizeControl({ editor, selectedFontSize }: { editor: Editor; selectedFontSize: string | null }) {
  return <>
    <Select aria-label="Font size preset" value={selectedFontSize ?? ""} onChange={(event) => setFontSize(editor, event.target.value || null)} className="h-8 w-[5.25rem] rounded-md border-slate-200 px-2 text-xs shadow-none">
      <option value="">Default</option>{fontSizes.map((size) => <option key={size} value={`${size}px`}>{size} px</option>)}
    </Select>
    <NumberInput aria-label="Custom font size in pixels" min={8} max={200} precision={0} value={Number(selectedFontSize?.replace("px", "") ?? 16)} onValueChange={(value) => setFontSize(editor, `${value}px`, false)} className="h-8 w-[5.25rem] rounded-md text-xs" />
  </>;
}

