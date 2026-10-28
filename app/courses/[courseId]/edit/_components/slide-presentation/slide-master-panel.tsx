"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { defaultSlideMaster, slideMasterPresets, type SlideMaster } from "@/lib/editor/slide-design";

export function SlideMasterPanel({ value, onChange }: { value?: SlideMaster; onChange: (value: SlideMaster) => void }) {
  const master = value ?? defaultSlideMaster;
  return (
    <section aria-label="Master slide settings" className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <div><h2 className="text-sm font-semibold">Master slide</h2><p className="mt-1 text-xs text-slate-500">Applied to every slide in this presentation.</p></div>
      <div className="grid grid-cols-2 gap-2" aria-label="Presentation themes">
        {slideMasterPresets.map((preset) => <Button key={preset.id} type="button" variant="outline" aria-pressed={master.template === preset.id} onClick={() => onChange({ ...master, template: preset.id, backgroundColor: preset.backgroundColor, textColor: preset.textColor, accentColor: preset.accentColor })} className="h-auto flex-col items-stretch gap-2 p-2 text-left text-xs aria-pressed:ring-2 aria-pressed:ring-indigo-500">
          <span className="flex h-9 flex-col justify-center rounded-sm px-2" style={{ background: preset.backgroundColor, color: preset.textColor, borderTop: `4px solid ${preset.accentColor}` }}><span className="h-1 w-2/3 rounded bg-current opacity-70" /></span>
          {preset.name}
        </Button>)}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {(["backgroundColor", "textColor", "accentColor"] as const).map((field) => <label key={field} className="text-[11px] text-slate-600"><span className="block truncate">{field === "backgroundColor" ? "Background" : field === "textColor" ? "Text" : "Accent"}</span><Input type="color" aria-label={`Master ${field}`} value={master[field]} onChange={(event) => onChange({ ...master, [field]: event.target.value })} className="mt-1 h-9 w-full cursor-pointer p-1" /></label>)}
      </div>
      <label className="block text-xs font-medium text-slate-600">Footer text<Input aria-label="Master footer text" maxLength={120} value={master.footerText} onChange={(event) => onChange({ ...master, footerText: event.target.value })} className="mt-1" /></label>
      <label className="flex items-center gap-2 text-xs text-slate-600"><Checkbox checked={master.showSlideNumber} onChange={(event) => onChange({ ...master, showSlideNumber: event.target.checked })} />Show slide numbers</label>
    </section>
  );
}
