"use client";

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/core";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { normalizeFontSize } from "@/lib/editor/text-format";
import { setFontSize } from "./text-formatting-commands";

const fontSizes = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 40, 44, 48, 56, 64, 72, 96, 120, 144, 160, 180, 200];

export function FontSizeControl({ editor, selectedFontSize }: { editor: Editor; selectedFontSize: string | null }) {
  const [fontSizeInput, setFontSizeInput] = useState(selectedFontSize?.replace("px", "") ?? "16");
  const customFontSize = normalizeFontSize(fontSizeInput);

  // Keep the field synced when the editor selection moves to text with another size.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setFontSizeInput(selectedFontSize?.replace("px", "") ?? "16"), [selectedFontSize]);

  function changeFontSize(value: string) {
    setFontSizeInput(value);
    const fontSize = normalizeFontSize(value);
    if (fontSize) setFontSize(editor, fontSize, false);
  }

  return <>
    <Select aria-label="Font size preset" value={selectedFontSize ?? ""} onChange={(event) => setFontSize(editor, event.target.value || null)} className="h-8 w-[5.25rem] rounded-md border-slate-200 px-2 text-xs shadow-none">
      <option value="">Default</option>{fontSizes.map((size) => <option key={size} value={`${size}px`}>{size} px</option>)}
    </Select>
    <Input aria-label="Custom font size in pixels" type="number" min={8} max={200} step={1} value={fontSizeInput} onChange={(event) => changeFontSize(event.target.value)} onBlur={() => {
      if (!customFontSize) setFontSizeInput(selectedFontSize?.replace("px", "") ?? "16");
    }} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} className="h-8 w-[4.25rem] rounded-md border-slate-200 px-2 text-xs shadow-none" />
  </>;
}

