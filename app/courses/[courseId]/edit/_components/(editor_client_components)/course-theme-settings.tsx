"use client";

import { Check, Palette, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  courseThemePresets,
  createCourseThemePreset,
  defaultCourseTheme,
  type CourseTheme,
} from "@/lib/editor/theme";
import { CourseCoverSettings } from "./(course_theme_settings_components)/course-cover-settings";

export function CourseThemeSettings({
  theme,
  onChange,
  courseId,
  courseTitle,
}: {
  theme: CourseTheme;
  onChange: (theme: CourseTheme) => void;
  courseId: string;
  courseTitle: string;
}) {
  return (
    <details className="relative">
      <summary
        aria-label="Course theme settings"
        title="Course theme"
        className="flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 [&::-webkit-details-marker]:hidden"
      >
        <Palette size={15} />
        <span>Theme</span>
      </summary>
      <div className="fixed inset-x-4 top-20 z-[60] mt-2 max-h-[calc(100dvh-100px)] overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white p-4 text-slate-900 shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:w-[360px]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Course theme</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">Choose a palette and type style for the learner experience.</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange({ ...defaultCourseTheme })}
            className="h-8 px-2 text-xs"
          >
            <RotateCcw size={13} />Reset
          </Button>
        </div>

        <fieldset className="mt-4">
          <legend className="mb-2 text-xs font-semibold text-slate-600">Palette</legend>
          <div className="grid grid-cols-5 gap-2">
            {courseThemePresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                aria-label={`Use ${preset.label} theme`}
                aria-pressed={theme.preset === preset.id}
                onClick={() => onChange({ ...createCourseThemePreset(preset.id), fontFamily: theme.fontFamily, cover: theme.cover })}
                className={`cursor-pointer flex min-w-0 flex-col items-center gap-1.5 rounded-lg border p-2 text-[10px] font-medium transition-colors ${theme.preset === preset.id ? "border-slate-900 bg-slate-50 text-slate-900" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
              >
                <span className="relative grid size-7 place-items-center rounded-full" style={{ backgroundColor: preset.primaryColor }}>
                  {theme.preset === preset.id && <Check size={14} className="text-white drop-shadow" />}
                </span>
                <span className="truncate">{preset.label}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="min-w-0 text-xs font-medium text-slate-600">
            Brand color
            <Input
              type="color"
              aria-label="Brand color"
              value={theme.primaryColor}
              onChange={(event) => onChange({ ...theme, preset: "custom", primaryColor: event.target.value })}
              className="mt-1 h-10 cursor-pointer p-1"
            />
          </label>
          <label className="min-w-0 text-xs font-medium text-slate-600">
            Accent color
            <Input
              type="color"
              aria-label="Accent color"
              value={theme.accentColor}
              onChange={(event) => onChange({ ...theme, preset: "custom", accentColor: event.target.value })}
              className="mt-1 h-10 cursor-pointer p-1"
            />
          </label>
        </div>

        <label className="mt-4 block text-xs font-medium text-slate-600">
          Typography
          <Select
            aria-label="Course typography"
            value={theme.fontFamily}
            onChange={(event) => onChange({ ...theme, fontFamily: event.target.value as CourseTheme["fontFamily"] })}
            className="mt-1 h-9"
          >
            <option value="sans">System sans</option>
            <option value="serif">Serif</option>
            <option value="rounded">Rounded</option>
          </Select>
        </label>
        <CourseCoverSettings courseId={courseId} courseTitle={courseTitle} theme={theme} onChange={onChange} />
        <p className="mt-3 border-t border-slate-100 pt-3 text-[11px] text-slate-500">Changes save automatically and appear in course previews and exports.</p>
      </div>
    </details>
  );
}
