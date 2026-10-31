"use client";

import Image from "next/image";
import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createClientId } from "@/lib/client-id";
import { hasLegacySlideFooterColors, resolveSlideFooter, slideFooterSchema, type SlideFooter, type SlideMaster } from "@/lib/editor/slide-design";
import { MediaLibraryDialog } from "../media-library-dialog";
import { ColorPicker } from "@/components/ui/color-picker";
import { courseThemeFontFamilyIds } from "@/lib/editor/theme";
import { SlideNumberSettingInput } from "./slide-number-setting-input";

export function SlideFooterControls({ master, courseId, onChange }: {
  master: SlideMaster;
  courseId: string;
  onChange: (master: SlideMaster) => void;
}) {
  const footer = resolveSlideFooter(master);
  const legacyColors = hasLegacySlideFooterColors(master.footer);
  const [picker, setPicker] = useState<{ id?: string } | null>(null);
  const update = (change: Partial<SlideFooter>) => {
    const source = legacyColors ? { ...master.footer, backgroundColor: undefined, textColor: undefined, borderColor: undefined } : master.footer;
    const colorsCustomized = (change.backgroundColor || change.textColor || change.borderColor) ? true : source?.colorsCustomized;
    onChange({ ...master, footer: slideFooterSchema.parse({ ...source, ...change, colorsCustomized }) });
  };
  function moveLogo(index: number, direction: number) {
    const next = index + direction;
    if (next < 0 || next >= footer.logos.length) return;
    const logos = [...footer.logos];
    [logos[index], logos[next]] = [logos[next], logos[index]];
    update({ logos });
  }
  return <section aria-label="Slide footer settings" className="space-y-3">
    <p className="text-xs text-slate-500">Full-width branding on every slide.</p>
    <div className="grid grid-cols-2 gap-2">{([
      { field: "height", label: "Height", min: 48, max: 160 }, { field: "fontSize", label: "Text size", min: 10, max: 24 }, { field: "contentGap", label: "Content gap", min: 0, max: 32 },
    ] as const).map(({ field, label, min, max }) => <label key={field} className="space-y-1 text-xs text-slate-600">{label} (px){field === "height" || field === "fontSize"
      ? <SlideNumberSettingInput aria-label={`Footer ${label.toLowerCase()} (px)`} min={min} max={max} value={footer[field]} onValueChange={(next) => update({ [field]: next })} />
      : <Input aria-label={`Footer ${label.toLowerCase()} (px)`} type="number" min={min} max={max} step={1} value={footer[field]} onChange={(event) => { const value = event.target.valueAsNumber; if (Number.isInteger(value) && value >= min && value <= max) update({ [field]: value }); }} />}</label>)}</div>
    <label className="block text-xs text-slate-600">Footer font<Select aria-label="Footer font family" value={footer.fontFamily ?? ""} className="mt-1" onChange={(event) => update({ fontFamily: event.target.value ? event.target.value as SlideFooter["fontFamily"] : undefined })}><option value="">Course font</option>{courseThemeFontFamilyIds.map((id) => <option key={id} value={id}>{id}</option>)}</Select></label>
    <div className="flex gap-3 text-xs text-slate-600">
      <label className="flex items-center gap-1"><Checkbox aria-label="Footer bold" checked={footer.fontWeight === "bold"} onChange={(event) => update({ fontWeight: event.target.checked ? "bold" : "normal" })} />Bold</label>
      <label className="flex items-center gap-1"><Checkbox aria-label="Footer italic" checked={footer.fontStyle === "italic"} onChange={(event) => update({ fontStyle: event.target.checked ? "italic" : "normal" })} />Italic</label>
    </div>
    <label className="block text-xs font-medium text-slate-600">Footer content<Select aria-label="Footer content" value={footer.content} className="mt-1" onChange={(event) => update({ content: event.target.value as SlideFooter["content"] })}><option value="text">Text</option><option value="logos">Logos</option><option value="both">Text and logos</option></Select></label>
    {footer.content !== "logos" && <label className="block text-xs font-medium text-slate-600">Footer text<Input aria-label="Master footer text" maxLength={120} value={master.footerText} onChange={(event) => onChange({ ...master, footerText: event.target.value })} className="mt-1" /></label>}
    {footer.content !== "text" && <div className="space-y-2" aria-label="Footer logo list">
      {footer.logos.map((logo, index) => <div key={logo.id} className="space-y-2 rounded-lg border border-slate-200 p-2">
        <div className="flex items-center gap-2">
          <span className="relative h-10 w-16 shrink-0 overflow-hidden rounded border bg-slate-50"><Image src={logo.src} alt={logo.alt} fill unoptimized sizes="64px" className="object-contain p-1" /></span>
          <Button type="button" variant="outline" size="sm" aria-label={`Replace footer logo ${index + 1}`} onClick={() => setPicker({ id: logo.id })}>Replace</Button>
          <div className="ml-auto flex gap-1">
            <Button type="button" variant="ghost" size="icon" className="size-7" aria-label={`Move footer logo ${index + 1} earlier`} disabled={index === 0} onClick={() => moveLogo(index, -1)}><ArrowUp size={14} /></Button>
            <Button type="button" variant="ghost" size="icon" className="size-7" aria-label={`Move footer logo ${index + 1} later`} disabled={index === footer.logos.length - 1} onClick={() => moveLogo(index, 1)}><ArrowDown size={14} /></Button>
            <Button type="button" variant="ghost" size="icon" className="size-7 text-rose-600" aria-label={`Remove footer logo ${index + 1}`} onClick={() => update({ logos: footer.logos.filter((item) => item.id !== logo.id) })}><Trash2 size={14} /></Button>
          </div>
        </div>
        <Input aria-label={`Footer logo ${index + 1} description`} placeholder="Logo description" maxLength={160} value={logo.alt} onChange={(event) => update({ logos: footer.logos.map((item) => item.id === logo.id ? { ...item, alt: event.target.value } : item) })} />
      </div>)}
      <Button type="button" variant="outline" size="sm" className="w-full" disabled={footer.logos.length >= 12} onClick={() => setPicker({})}><Plus size={14} />Add footer logo</Button>
      <p className="text-[11px] text-slate-500">Choose or upload up to 12 logos. Each image keeps its original proportions and scales down to fit the footer.</p>
      <div className="grid grid-cols-2 gap-2" aria-label="Footer logo layout">
        {(["logoGapX", "logoGapY"] as const).map((field) => <label key={field} className="text-xs text-slate-600">{field === "logoGapX" ? "Horizontal gap (px)" : "Vertical gap (px)"}<Input aria-label={field === "logoGapX" ? "Footer logo horizontal gap" : "Footer logo vertical gap"} type="number" min={0} max={field === "logoGapX" ? 32 : 12} step={1} value={footer[field] ?? (field === "logoGapX" ? 8 : 4)} className="mt-1 h-9" onChange={(event) => {
          const value = event.target.valueAsNumber;
          if (Number.isFinite(value)) update({ [field]: Math.min(field === "logoGapX" ? 32 : 12, Math.max(0, Math.round(value))) });
        }} /></label>)}
        <label className="text-xs text-slate-600">Justification<Select aria-label="Footer logo justification" value={footer.logoJustify ?? "center"} className="mt-1" onChange={(event) => update({ logoJustify: event.target.value as SlideFooter["logoJustify"] })}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option><option value="between">Space between</option></Select></label>
        <label className="text-xs text-slate-600">Vertical alignment<Select aria-label="Footer logo vertical alignment" value={footer.logoAlign ?? "middle"} className="mt-1" onChange={(event) => update({ logoAlign: event.target.value as SlideFooter["logoAlign"] })}><option value="top">Top</option><option value="middle">Middle</option><option value="bottom">Bottom</option></Select></label>
      </div>
    </div>}
    <fieldset className="space-y-2">
      <legend className="text-xs font-medium text-slate-600">Footer padding</legend>
      <div className="grid grid-cols-2 gap-2">
        {(["paddingX", "paddingY"] as const).map((field) => <label key={field} className="text-xs text-slate-600">{field === "paddingX" ? "Horizontal (px)" : "Vertical (px)"}<Input aria-label={field === "paddingX" ? "Footer horizontal padding" : "Footer vertical padding"} type="number" min={0} max={field === "paddingX" ? 64 : 32} step={1} value={footer[field] ?? (field === "paddingX" ? 20 : 8)} className="mt-1 h-9" onChange={(event) => {
          const value = event.target.valueAsNumber;
          if (Number.isFinite(value)) update({ [field]: Math.min(field === "paddingX" ? 64 : 32, Math.max(0, Math.round(value))) });
        }} /></label>)}
      </div>
      <p className="text-[11px] text-slate-500">Space inside the footer around text, logos, slide numbers, and navigation.</p>
    </fieldset>
    <div className="grid grid-cols-2 gap-2">
      {(["backgroundColor", "textColor"] as const).map((field) => <div key={field} className="space-y-1 text-xs text-slate-600">{field === "backgroundColor" ? "Footer background" : "Footer text color"}<ColorPicker aria-label={field === "backgroundColor" ? "Footer background color" : "Footer text color"} value={footer[field]} onChange={(color) => update({ [field]: color })} /></div>)}
    </div>
    {!legacyColors && (master.footer?.backgroundColor || master.footer?.textColor) && <div className="flex flex-wrap gap-1">
      {master.footer?.backgroundColor && <Button type="button" variant="ghost" size="sm" onClick={() => update({ backgroundColor: undefined })}>Use theme background</Button>}
      {master.footer?.textColor && <Button type="button" variant="ghost" size="sm" onClick={() => update({ textColor: undefined })}>Use theme text</Button>}
    </div>}
    <label className="flex items-center gap-2 text-xs text-slate-600"><Checkbox aria-label="Footer top border" checked={footer.borderTop} onChange={(event) => update({ borderTop: event.target.checked })} />Top border</label>
    {footer.borderTop && <div className="grid grid-cols-2 gap-2">
      <div className="space-y-1 text-xs text-slate-600">Border color<ColorPicker aria-label="Footer border color" value={footer.borderColor} onChange={(color) => update({ borderColor: color })} /></div>
      <label className="text-xs text-slate-600">Border width<Input aria-label="Footer border width" type="number" min={1} max={6} value={footer.borderWidth} className="mt-1 h-9" onChange={(event) => { const value = Number(event.target.value); if (Number.isFinite(value)) update({ borderWidth: Math.min(6, Math.max(1, Math.round(value))) }); }} /></label>
    </div>}
    {footer.borderTop && !legacyColors && master.footer?.borderColor && <Button type="button" variant="ghost" size="sm" onClick={() => update({ borderColor: undefined })}>Use theme accent border</Button>}
    <label className="flex items-center gap-2 text-xs text-slate-600"><Checkbox aria-label="Show slide numbers" checked={master.showSlideNumber} onChange={(event) => onChange({ ...master, showSlideNumber: event.target.checked })} />Show slide numbers</label>
    <MediaLibraryDialog courseId={courseId} kind="image" open={picker !== null} onClose={() => setPicker(null)} onSelect={(asset) => {
      const previous = footer.logos.find((logo) => logo.id === picker?.id);
      const logo = { id: previous?.id ?? createClientId(), src: asset.fileUrl, alt: (previous?.alt || asset.originalName).slice(0, 160) };
      update({ logos: previous ? footer.logos.map((item) => item.id === previous.id ? logo : item) : [...footer.logos, logo].slice(0, 12) });
      setPicker(null);
    }} />
  </section>;
}
