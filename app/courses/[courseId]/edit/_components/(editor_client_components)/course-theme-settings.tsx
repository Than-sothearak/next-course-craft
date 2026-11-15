"use client";

import { Check, Image, Palette, RotateCcw, Settings2, Type } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Button, buttonVariants } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import { SettingsSection, SettingsSectionActions, SettingsSectionsProvider } from "@/components/ui/settings-section";
import { cn } from "@/lib/utils";
import { courseThemeFontFamilies, courseThemePresets, createCourseThemePreset, defaultCourseTheme, type CourseTheme } from "@/lib/editor/theme";
import { CourseCoverSettings } from "./(course_theme_settings_components)/course-cover-settings";
import { CourseTypographySettings } from "./(course_theme_settings_components)/course-typography-settings";

export function CourseThemeSettings({ theme, onChange, courseId, courseTitle, compact = false }: {
  theme: CourseTheme;
  onChange: (theme: CourseTheme) => void;
  courseId: string;
  courseTitle: string;
  compact?: boolean;
}) {
  return <details className="relative">
    <summary aria-label="Course theme settings" title="Course theme" className={compact ? cn(buttonVariants({ variant: "ghost", size: "sm" }), "size-8 min-h-0 cursor-pointer list-none rounded-md p-0 text-xs text-slate-600 [&::-webkit-details-marker]:hidden") : "flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 [&::-webkit-details-marker]:hidden"}>
      <Palette size={16} aria-hidden="true" /><span className={compact ? "sr-only" : undefined}>Theme</span>
    </summary>
    <SettingsSectionsProvider>
      <div data-course-theme-settings className="fixed inset-x-4 top-20 z-[60] mt-2 flex max-h-[calc(100dvh-100px)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-xs text-slate-700 shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:w-[380px] [&_input]:text-xs [&_select]:text-xs [&_textarea]:text-xs [&_button]:text-xs [&_label]:text-xs">
        <div data-settings-panel-header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
          <h2 className="flex items-center gap-2 font-semibold"><Palette size={15} aria-hidden="true" />Course theme</h2>
          <SettingsSectionActions label="Course theme" />
        </div>
        <div className="min-h-0 space-y-3 overflow-y-auto overscroll-contain p-3">
          <SettingsSection title="Palette & colors" icon={Palette}>
            <div className="grid grid-cols-3 gap-2">{courseThemePresets.map((preset) => <Button key={preset.id} type="button" variant="outline" aria-label={`Use ${preset.label} theme`} aria-pressed={theme.preset === preset.id} onClick={() => onChange({ ...theme, ...createCourseThemePreset(preset.id), fontFamily: theme.fontFamily, typography: theme.typography, cover: theme.cover })} className={`relative h-auto min-w-0 flex-col gap-2 px-2 py-2 text-[11px] ${theme.preset === preset.id ? "border-indigo-500 bg-indigo-50/50 ring-1 ring-indigo-500" : "border-slate-200"}`}>
              <span className="flex h-7 w-full overflow-hidden rounded border border-black/5"><span className="flex-1" style={{ backgroundColor: preset.primaryColor }} /><span className="w-1/3" style={{ backgroundColor: preset.accentColor }} /></span><span>{preset.label}</span>{theme.preset === preset.id && <Check size={12} aria-hidden="true" className="absolute right-1 top-1 rounded-full bg-white text-indigo-600" />}
            </Button>)}</div>
            <label className="block space-y-1 text-slate-600">Brand color<ColorPicker aria-label="Brand color" allowGradient={false} value={theme.primaryColor} onChange={(primaryColor) => onChange({ ...theme, preset: "custom", primaryColor })} /></label>
            <label className="block space-y-1 text-slate-600">Accent color<ColorPicker aria-label="Accent color" allowGradient={false} value={theme.accentColor} onChange={(accentColor) => onChange({ ...theme, preset: "custom", accentColor })} /></label>
          </SettingsSection>
          <SettingsSection title="Typography" icon={Type}>
            <label className="block space-y-1 text-slate-600">Font family<Select aria-label="Course typography" value={theme.fontFamily} onChange={(event) => onChange({ ...theme, fontFamily: event.target.value as CourseTheme["fontFamily"] })} className="h-9">
              <option value="sans">System sans</option><option value="serif">Serif</option><option value="rounded">Rounded</option><optgroup label="Khmer fonts"><option value="noto-sans-khmer">Noto Sans Khmer</option><option value="battambang">Battambang</option><option value="kantumruy-pro">Kantumruy Pro</option><option value="nokora">Nokora</option></optgroup>
            </Select></label>
            <div className="rounded-lg bg-slate-50 p-3" style={{ fontFamily: courseThemeFontFamilies[theme.fontFamily] }}><p className="text-lg font-semibold">A new way to learn</p><p lang="km" className="mt-1 text-sm text-slate-500" style={{ fontFamily: courseThemeFontFamilies[theme.fontFamily] }}>សូមមើលគំរូអក្សរខ្មែរ និងពាក្យ Lab។</p></div>
          </SettingsSection>
          <SettingsSection title="Course cover" icon={Image}><CourseCoverSettings courseId={courseId} courseTitle={courseTitle} theme={theme} onChange={onChange} /></SettingsSection>
          <SettingsSection title="Advanced" label="Advanced course theme settings" icon={Settings2} defaultOpen={false}>
            <CourseTypographySettings theme={theme} onChange={onChange} />
            <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => onChange({ ...defaultCourseTheme })}><RotateCcw size={13} aria-hidden="true" />Reset</Button>
          </SettingsSection>
          <p className="text-[11px] leading-5 text-slate-500">Changes save automatically and appear in previews and exports.</p>
        </div>
      </div>
    </SettingsSectionsProvider>
  </details>;
}
