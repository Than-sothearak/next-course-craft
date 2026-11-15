"use client";

import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import { TextAlignmentControl } from "@/components/ui/text-alignment-control";
import { courseTypographySchema, type CourseTheme, type CourseTypography } from "@/lib/editor/theme";

const sizes = [
  { key: "titleSize", label: "Title", fallback: 36, min: 12, max: 96 },
  { key: "subtitleSize", label: "Subtitle", fallback: 24, min: 12, max: 72 },
  { key: "headingSize", label: "Heading", fallback: 20, min: 12, max: 64 },
  { key: "bodySize", label: "Normal text", fallback: 16, min: 10, max: 36 },
] as const;

export function CourseTypographySettings({ theme, onChange }: { theme: CourseTheme; onChange: (theme: CourseTheme) => void }) {
  const typography = theme.typography ?? {};
  const update = (patch: Partial<CourseTypography>) => {
    const parsed = courseTypographySchema.safeParse({ ...typography, ...patch });
    if (parsed.success) onChange({ ...theme, typography: parsed.data });
  };
  const commitShownDefault = (key: Exclude<keyof CourseTypography, "titleAlignment">, fallback: number, text: string) => {
    if (typography[key] === undefined && text.trim() && Number(text) === fallback) update({ [key]: fallback });
  };
  return <div className="space-y-4">
    <div><h3 className="mb-2 text-xs font-semibold text-slate-700">Default font sizes</h3><div className="grid grid-cols-2 gap-3">{sizes.map(({ key, label, fallback, min, max }) => <label key={key} className="block min-w-0 space-y-1 text-xs text-slate-600">{label} (px)<NumberInput aria-label={`Default ${label.toLowerCase()} size`} precision={0} min={min} max={max} value={typography[key] ?? fallback} onInputCapture={(event) => commitShownDefault(key, fallback, event.currentTarget.value)} onValueChange={(value) => update({ [key]: value })} className="h-9" /></label>)}</div></div>
    <div className="space-y-2"><h3 className="text-xs font-semibold text-slate-700">Title alignment</h3><TextAlignmentControl label="Default title alignment" value={typography.titleAlignment ?? "left"} onChange={(titleAlignment) => update({ titleAlignment })} /></div>
    <label className="block space-y-1 text-xs text-slate-600">Normal text line spacing<NumberInput aria-label="Default text line spacing" min={1} max={2.4} step={0.1} precision={2} value={typography.lineHeight ?? 1.75} onInputCapture={(event) => commitShownDefault("lineHeight", 1.75, event.currentTarget.value)} onValueChange={(lineHeight) => update({ lineHeight })} className="h-9" /></label>
    <p className="text-[11px] leading-5 text-slate-500">Defaults style Standard course titles, headings and normal text. Selected-text formatting takes precedence. Presentation slides use their Master slide typography.</p>
    <Button variant="outline" size="sm" className="w-full" onClick={() => onChange({ ...theme, typography: undefined })}>Restore default typography</Button>
  </div>;
}
