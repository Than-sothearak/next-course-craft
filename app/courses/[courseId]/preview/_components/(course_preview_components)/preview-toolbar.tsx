"use client";

import { ArrowLeft, Monitor, RotateCw, Smartphone, Tablet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublishMenu } from "@/components/publish-menu";
import type { PreviewDevice, PreviewMode, PreviewOrientation } from "./preview-types";

type PreviewToolbarProps = {
  standalone: boolean;
  onEdit?: () => void;
  mode: PreviewMode;
  device: PreviewDevice;
  orientation: PreviewOrientation;
  courseId: string;
  courseTitle: string;
  onModeChange: (mode: PreviewMode) => void;
  onStartLearning: () => void;
  onDeviceChange: (device: PreviewDevice) => void;
  onOrientationChange: (orientation: PreviewOrientation) => void;
};

export function PreviewToolbar({
  standalone,
  onEdit,
  mode,
  device,
  orientation,
  courseId,
  courseTitle,
  onModeChange,
  onStartLearning,
  onDeviceChange,
  onOrientationChange,
}: PreviewToolbarProps) {
  if (standalone) return null;
  const isLandscape = orientation === "landscape";
  return (
    <header className="relative z-50 flex min-h-14 shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-200 bg-white px-3 py-2 sm:px-5">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Back to course editor"
          title="Back to editor"
          onClick={onEdit}
        >
          <ArrowLeft size={18} />
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Course Preview</span>
          <span className="hidden text-xs text-slate-500 sm:inline">
            Current version
          </span>
        </div>
      </div>
      <div
        className="flex items-center rounded-lg bg-slate-100 p-0.5"
        role="group"
        aria-label="Preview mode"
      >
        <Button
          type="button"
          variant={mode === "course" ? "secondary" : "ghost"}
          size="sm"
          aria-pressed={mode === "course"}
          onClick={() => onModeChange("course")}
          className="h-8 px-2.5 text-xs sm:px-3"
        >
          Preview course
        </Button>
        <Button
          type="button"
          variant={mode === "learn" ? "secondary" : "ghost"}
          size="sm"
          aria-pressed={mode === "learn"}
          onClick={onStartLearning}
          className="h-8 px-2.5 text-xs sm:px-3"
        >
          Learn
        </Button>
      </div>
      <div
        className="ml-auto flex items-center gap-1"
        role="group"
        aria-label="Preview device controls"
      >
        {(
          [
            { id: "desktop", label: "Desktop", Icon: Monitor },
            { id: "tablet", label: "Tablet", Icon: Tablet },
            { id: "mobile", label: "Mobile", Icon: Smartphone },
          ] as const
        ).map(({ id, label, Icon }) => (
          <Button
            key={id}
            type="button"
            variant={device === id ? "secondary" : "ghost"}
            size="icon"
            aria-label={`Preview on ${label.toLowerCase()}`}
            aria-pressed={device === id}
            title={label}
            onClick={() => {
              onDeviceChange(id);
            }}
            className="size-8"
          >
            <Icon
              size={16}
              className={
                device === id && id !== "desktop" && isLandscape
                  ? "rotate-90 transition-transform"
                  : "transition-transform"
              }
            />
          </Button>
        ))}
        {device !== "desktop" && (
          <div
            className="ml-1 flex h-8 items-center gap-0.5 rounded-lg bg-slate-100 p-0.5"
            role="group"
            aria-label="Device orientation"
          >
            <span className="px-1.5 text-[11px] font-medium text-slate-500">
              {isLandscape ? "Landscape" : "Portrait"}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`Flip device to ${isLandscape ? "portrait" : "landscape"}`}
              title={`Flip device to ${isLandscape ? "portrait" : "landscape"}`}
              onClick={() =>
                onOrientationChange(isLandscape ? "portrait" : "landscape")
              }
              className="h-7 gap-1 px-2 text-[11px]"
            >
              <RotateCw size={14} />
              Flip
            </Button>
          </div>
        )}
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={onEdit}
          className="ml-1 h-8 px-3 text-xs"
        >
          Edit
        </Button>
        <PublishMenu courseId={courseId} title={courseTitle} className="h-8 px-2.5 text-xs sm:px-3" />
      </div>
    </header>
  );
}
