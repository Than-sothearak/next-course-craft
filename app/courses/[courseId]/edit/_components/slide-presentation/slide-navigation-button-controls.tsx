"use client";

import { useState } from "react";
import { ArrowRight, Box, Droplets, Layers, Maximize, Minus, MoveHorizontal, MoveVertical, RotateCcw, Sparkles, Square, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { backgroundPaint, solidColor, textPaint } from "@/lib/color";
import { resolveSlideFooter, type SlideMaster } from "@/lib/editor/slide-design";
import { navigationButtonAppearance, navigationButtonPaint, navigationButtonMetrics, navigationButtonAppearanceSchema, navigationButtonKeys, navigationPreset, resolveNavigationButtons, type NavigationButtonAppearance, type NavigationButtonKey } from "@/lib/editor/slide-navigation-design";

const styles = [
  { id: "outline", label: "Outline", Icon: Square }, { id: "solid", label: "Solid", Icon: Box },
  { id: "soft", label: "Soft", Icon: Layers }, { id: "modern", label: "Modern", Icon: Sparkles },
  { id: "glass", label: "Glass", Icon: Droplets }, { id: "threeD", label: "3D raised", Icon: Box },
] as const;
const numbers = [
  { field: "height", label: "Height", min: 28, max: 72, Icon: MoveVertical },
  { field: "minWidth", label: "Min. width", min: 64, max: 200, Icon: MoveHorizontal },
  { field: "paddingX", label: "Side padding", min: 4, max: 32, Icon: MoveHorizontal },
  { field: "radius", label: "Corner radius", min: 0, max: 36, Icon: Square },
  { field: "fontSize", label: "Text size", min: 10, max: 18, Icon: Type },
  { field: "iconSize", label: "Icon size", min: 12, max: 28, Icon: Maximize },
  { field: "borderWidth", label: "Border width", min: 0, max: 4, Icon: Minus },
  { field: "depth", label: "3D depth", min: 2, max: 10, Icon: Layers },
] as const;

export function SlideNavigationButtonControls({ master, onChange }: { master: SlideMaster; onChange: (master: SlideMaster) => void }) {
  const [target, setTarget] = useState<"all" | NavigationButtonKey>("all");
  const footer = resolveSlideFooter(master);
  const settings = resolveNavigationButtons(master.navigationButtons, footer.textColor);
  const appearance = navigationButtonAppearance(settings, target === "all" ? "previous" : target);
  const shared = target === "all" ? { ...settings, overrides: undefined } : settings;
  const selected = target === "all" ? navigationButtonAppearance(shared, "previous") : appearance;
  const themeColors = [{ key: "accent", label: "Accent", value: master.accentColor }, { key: "text", label: "Text", value: master.textColor }, { key: "background", label: "Background", value: master.backgroundColor }];
  function update(change: Partial<NavigationButtonAppearance>) {
    const next = target === "all" ? { ...settings, ...change } : { ...settings, overrides: { ...settings.overrides, [target]: { ...appearance, ...change } } };
    const requiredHeight = Math.max(...navigationButtonKeys.map((key) => { const item = navigationButtonAppearance(next, key), metrics = navigationButtonMetrics(item, key === "restart"); return metrics.height + metrics.depth; })) + footer.paddingY * 2 + (footer.borderTop ? footer.borderWidth : 0);
    onChange({ ...master, navigationButtons: next, footer: requiredHeight > footer.height ? { ...footer, height: Math.min(160, Math.ceil(requiredHeight)) } : master.footer });
  }
  return <div className="space-y-4">
    <label className="block space-y-1 text-xs font-medium text-slate-600">Customize<Select aria-label="Navigation button target" value={target} onChange={(event) => setTarget(event.target.value as typeof target)}><option value="all">All buttons (shared style)</option><option value="previous">Previous</option><option value="restart">Restart icon</option><option value="next">Next</option></Select></label>
    <div className="grid grid-cols-2 gap-2" aria-label="Navigation button styles">{styles.map(({ id, label, Icon }) => {
      const preset = { ...selected, ...navigationPreset(id), height: 26, fontSize: 10, paddingX: 10, radius: Math.min(12, navigationPreset(id).radius ?? 6) };
      return <Button key={id} variant="outline" size="sm" aria-label={`Navigation style ${label}`} aria-pressed={selected.style === id} className="h-auto min-w-0 flex-col gap-1.5 p-2 text-[11px] aria-pressed:border-indigo-400 aria-pressed:bg-indigo-50" onClick={() => update(navigationPreset(id))}>
        <span className="relative flex w-full items-center justify-center" style={{ ...navigationButtonPaint(preset), boxShadow: id === "threeD" ? `0 3px 0 ${solidColor(preset.borderColor)}` : navigationButtonPaint(preset).boxShadow }}><span style={textPaint(preset.textColor)}>Next</span><ArrowRight size={12} aria-hidden="true" /></span>
        <span className="mt-0.5 flex items-center gap-1.5"><Icon size={12} aria-hidden="true" />{label}</span>
      </Button>;
    })}</div>
    <div className="grid grid-cols-2 gap-3">{(["backgroundColor", "textColor", "borderColor"] as const).filter((field) => field !== "backgroundColor" || selected.style !== "outline").map((field) => {
      const name = field === "backgroundColor" ? "fill" : field === "textColor" ? "text" : "border";
      return <div key={field} className="space-y-1.5 text-xs text-slate-600"><span>{field === "backgroundColor" ? "Fill" : field === "textColor" ? "Text & icon" : selected.style === "threeD" ? "Border & depth" : "Border"}</span>
        <ColorPicker aria-label={`Navigation button ${name} color`} value={selected[field]} onChange={(color) => update({ [field]: color })} />
        <div role="group" aria-label={`Master theme colors for navigation button ${name}`} className="space-y-1"><p className="text-[10px] text-slate-500">Master theme</p><div className="flex flex-wrap gap-1">{themeColors.map((color) => <Button key={color.key} variant={selected[field] === color.value ? "secondary" : "ghost"} size="sm" className="min-h-6 gap-1 rounded-md px-1 text-[10px]" aria-label={`Use master ${color.key} for navigation button ${name}`} aria-pressed={selected[field] === color.value} title={color.value} onClick={() => update({ [field]: color.value })}><span aria-hidden="true" className="size-2.5 shrink-0 rounded-sm border border-slate-300" style={backgroundPaint(color.value)} />{color.label}</Button>)}</div></div>
      </div>;
    })}</div>
    <div className="grid grid-cols-2 gap-2">{numbers.filter((item) => item.field !== "depth" || selected.style === "threeD").filter((item) => item.field !== "fontSize" || target !== "restart").map(({ field, label, min, max, Icon }) => <label key={field} className="space-y-1 text-[11px] text-slate-600"><span className="flex items-center gap-1"><Icon size={12} aria-hidden="true" />{label} (px)</span><Input type="number" aria-label={`Navigation button ${label.toLowerCase()} (px)`} min={min} max={max} step={1} value={selected[field]} onChange={(event) => { const parsed = navigationButtonAppearanceSchema.safeParse({ ...selected, [field]: event.target.valueAsNumber }); if (parsed.success) update({ [field]: parsed.data[field] }); }} /></label>)}</div>
    <div className="grid grid-cols-2 gap-2">
      {selected.style !== "outline" && <label className="space-y-1 text-xs text-slate-600">Fill opacity (%)<Input type="number" aria-label="Navigation button fill opacity" min={0} max={100} step={1} value={selected.fillOpacity} onChange={(event) => { const value = event.target.valueAsNumber; if (Number.isInteger(value) && value >= 0 && value <= 100) update({ fillOpacity: value }); }} /></label>}
      <label className="space-y-1 text-xs text-slate-600">Button gap (px)<Input type="number" aria-label="Navigation button gap (px)" min={0} max={24} step={1} value={settings.gap} onChange={(event) => { const gap = event.target.valueAsNumber; if (Number.isInteger(gap) && gap >= 0 && gap <= 24) onChange({ ...master, navigationButtons: { ...settings, gap } }); }} /></label>
    </div>
    <p className="text-[11px] leading-4 text-slate-500">Restart uses an icon. Buttons fit the footer and use compact icons in tight spaces. Larger buttons can increase footer height. Individual styles take priority over the shared style.</p>
    <Button variant="ghost" size="sm" className="w-full" onClick={() => onChange({ ...master, navigationButtons: target === "all" ? undefined : { ...settings, overrides: { ...settings.overrides, [target]: undefined } } })}><RotateCcw size={13} aria-hidden="true" />{target === "all" ? "Reset all button styles" : "Use shared button style"}</Button>
  </div>;
}
