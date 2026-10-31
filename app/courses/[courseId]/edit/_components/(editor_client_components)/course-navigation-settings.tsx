"use client";

import { Check, PanelLeftOpen } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
    <details className="relative">
      <summary
        aria-label="Navigation and progress settings"
        title="Navigation & Progress"
        className={compact ? cn(buttonVariants({ variant: "ghost", size: "sm" }), "size-8 min-h-0 cursor-pointer list-none rounded-md p-0 text-xs text-slate-600 [&::-webkit-details-marker]:hidden") : "flex min-h-9 cursor-pointer list-none items-center gap-2 whitespace-nowrap rounded-md border border-slate-300 bg-white px-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 sm:px-3 sm:text-sm [&::-webkit-details-marker]:hidden"}
      >
        <PanelLeftOpen size={16} aria-hidden="true" />
        <span className={compact ? "sr-only" : undefined}>Navigation &amp; Progress</span>
      </summary>
      <div className={compact ? "fixed inset-x-3 top-20 z-[60] mt-2 max-h-[calc(100dvh-100px)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 text-slate-900 shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:w-[400px]" : "absolute right-0 top-full z-[60] mt-2 w-[min(400px,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-4 text-slate-900 shadow-xl"}>
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
        <p className="mt-3 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
          Changes save automatically and apply to course previews and exports.
        </p>
      </div>
    </details>
  );
}
