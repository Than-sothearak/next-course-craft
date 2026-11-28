"use client";

import { Check, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover } from "@/components/ui/popover";
import {
  courseNavigationModeOptions,
  type CourseNavigationMode,
} from "@/lib/editor/navigation";

export function CourseNavigationSettings({
  navigationMode,
  onChange,
  compact = false,
}: {
  navigationMode: CourseNavigationMode;
  onChange: (navigationMode: CourseNavigationMode) => void;
  compact?: boolean;
}) {
  return (
    <Popover title="Navigation & Progress" triggerLabel="Navigation and progress settings" placement="bottom" variant="panel"
      trigger={<><PanelLeftOpen size={16} aria-hidden="true" /><span className={compact ? "sr-only" : undefined}>Navigation &amp; Progress</span></>}
      triggerProps={{ title: "Navigation & Progress", variant: compact ? "ghost" : "outline", size: "sm", className: compact ? "size-8 min-h-0 rounded-md p-0 text-xs text-slate-600" : "h-auto w-auto min-h-9 px-2 text-xs text-slate-700 sm:px-3 sm:text-sm" }}
      panelClassName="w-[400px]">
        <div>
          <h2 className="text-sm font-semibold">Navigation &amp; Progress</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Choose how students move through this course.
          </p>
        </div>
        <fieldset className="mt-4 space-y-2">
          <legend className="sr-only">Lesson progression options</legend>
          {courseNavigationModeOptions.map((option) => {
            const selected = navigationMode === option.value;
            return (
              <Button
                key={option.value}
                type="button"
                variant="ghost"
                aria-pressed={selected}
                onClick={() => onChange(option.value)}
                className={`h-auto min-h-0 w-full justify-start whitespace-normal rounded-lg border p-3 text-left shadow-none ${selected ? "border-slate-900 bg-slate-50 hover:bg-slate-50" : "border-slate-200 hover:bg-slate-50"}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-slate-900">
                    {option.title}
                  </span>
                  <span className="mt-1 block text-[11px] font-normal leading-relaxed text-slate-500">
                    {option.description}
                  </span>
                </span>
                {selected && (
                  <Check
                    size={15}
                    aria-hidden="true"
                    className="mt-0.5 shrink-0 text-slate-900"
                  />
                )}
              </Button>
            );
          })}
        </fieldset>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          Switching to Restricted makes activities and media required. Switching away makes them optional. Continue buttons and interaction buttons keep their individual settings in every mode. New buttons start required.
        </p>
        <p className="mt-3 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
          Changes save automatically and apply to course previews and exports.
        </p>
    </Popover>
  );
}
