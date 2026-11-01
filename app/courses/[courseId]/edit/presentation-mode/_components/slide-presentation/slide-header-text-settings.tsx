"use client";

import { Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolveSlideHeaderTypography, type SlideHeaderStyle, type SlideMaster } from "@/lib/editor/slide-design";
import { SlideTypographyControls } from "./slide-typography-controls";

export function SlideHeaderTextSettings({ master, value, onChange }: { master?: SlideMaster; value?: SlideHeaderStyle; onChange: (style?: SlideHeaderStyle) => void }) {
  return <section aria-label="Slide header text settings" className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
    <h2 className="flex items-center gap-2 text-xs font-semibold text-slate-700"><Type size={15} aria-hidden="true" className="text-indigo-600" />Slide header</h2>
    <p className="text-xs leading-5 text-slate-500">Edit the title directly on the slide. These text settings apply to this slide only.</p>
    <SlideTypographyControls label="Slide header" value={resolveSlideHeaderTypography(master, value)} sizeRange={[12, 72]} onChange={onChange} />
    <Button variant="outline" size="sm" className="w-full" disabled={!value} onClick={() => onChange(undefined)}>Use master header text style</Button>
  </section>;
}
