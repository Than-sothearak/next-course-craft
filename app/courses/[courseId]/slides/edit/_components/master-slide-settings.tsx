"use client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { masterSettingsForSlide } from "@/lib/slides/master-schema";
import type { SlideRecord } from "@/lib/slides/schema";

export function MasterSlideSettings({ slide, disabled, onEditMaster, onUpdate }: { slide: SlideRecord; disabled: boolean; onEditMaster?: () => void; onUpdate: (update: (slide: SlideRecord) => SlideRecord) => void }) {
  const { masterOverrides, numbering } = masterSettingsForSlide(slide);
  function change(patch: Pick<SlideRecord, "masterOverrides" | "numbering">) {
    onUpdate((current) => current.composition
      ? { ...current, masterOverrides: undefined, numbering: undefined, composition: { ...current.composition, ...patch } }
      : { ...current, ...patch });
  }
  return <fieldset disabled={disabled} className="space-y-2 rounded-lg border p-3">
    <p className="text-xs font-semibold">Slide master · {masterOverrides ? "Has overrides" : "Inheriting"}</p>
    <Button size="sm" variant="outline" onClick={onEditMaster}>Edit this slide’s master</Button>
    <Button size="sm" variant="ghost" disabled={!masterOverrides && !numbering} onClick={() => change({ masterOverrides: undefined, numbering: undefined })}>Reset to master</Button>
    <label className="flex items-center gap-2 text-xs"><Checkbox aria-label="Hide slide number" checked={numbering?.hidden ?? false} onChange={(event) => change({ masterOverrides, numbering: { ...numbering, hidden: event.target.checked } })} />Hide slide number</label>
    <label className="block space-y-1 text-xs font-medium text-slate-600"><span>Slide number override</span><Input aria-label="Slide number override" placeholder="Automatic" maxLength={16} value={numbering?.value ?? ""} onChange={(event) => change({ masterOverrides, numbering: { ...numbering, value: event.target.value } })} /></label>
  </fieldset>;
}
