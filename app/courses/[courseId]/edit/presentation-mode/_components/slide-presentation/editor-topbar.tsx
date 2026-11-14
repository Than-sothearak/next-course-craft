"use client";

import type { ReactNode } from "react";
import { ArrowLeft, Eye, List, Presentation, Redo2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CourseNavigationMode } from "@/lib/editor/navigation";
import type { CourseTheme } from "@/lib/editor/theme";
import { CourseNavigationSettings } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/course-navigation-settings";
import { CourseThemeSettings } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/course-theme-settings";

type SaveState = "saved" | "saving" | "error" | "conflict";

type Props = {
  slideCourse: boolean;
  isPresentationWorkspace: boolean;
  focusedLessonId?: string;
  courseId: string;
  lessonTitle?: string;
  courseTitle: string;
  hasActiveLesson: boolean;
  canManageBlocks: boolean;
  saveStatus: ReactNode;
  saveState: SaveState;
  saveMessage: string;
  onRetrySave: () => void;
  blockManagerOpen: boolean;
  onToggleBlockManager: () => void;
  theme: CourseTheme;
  onThemeChange: (theme: CourseTheme) => void;
  navigationMode: CourseNavigationMode;
  onNavigationModeChange: (mode: CourseNavigationMode) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onPreview: () => void;
  onBackToOutline: () => void;
  onBackToCourse: () => void;
  onBackToDashboard: () => void;
  onReloadCourse: () => void;
};

export function EditorTopbar({
  slideCourse,
  isPresentationWorkspace,
  focusedLessonId,
  courseId,
  lessonTitle,
  courseTitle,
  hasActiveLesson,
  canManageBlocks,
  saveStatus,
  saveState,
  saveMessage,
  onRetrySave,
  blockManagerOpen,
  onToggleBlockManager,
  theme,
  onThemeChange,
  navigationMode,
  onNavigationModeChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onPreview,
  onBackToOutline,
  onBackToCourse,
  onBackToDashboard,
  onReloadCourse,
}: Props) {
  function renderBackControl() {
    if (hasActiveLesson && !focusedLessonId) {
      const label = slideCourse
        ? "Presentation settings"
        : "Back to course outline";
      return (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onBackToOutline}
          aria-label={label}
          title={label}
          className="size-9 shrink-0 rounded-lg text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft size={18} />
        </Button>
      );
    }

    if (focusedLessonId) {
      return (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Back to course"
          title="Back to course"
          className="size-9 shrink-0 rounded-lg text-slate-500 hover:text-slate-900"
          onClick={onBackToCourse}
        >
          <ArrowLeft size={18} />
        </Button>
      );
    }

    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onBackToDashboard}
        aria-label="Back to dashboard"
        title="Back to dashboard"
        className="size-9 shrink-0 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
      >
        <ArrowLeft size={18} />
      </Button>
    );
  }

  return (
    <header
      data-presentation-editor-header={slideCourse || undefined}
      className={`sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur ${isPresentationWorkspace ? "shrink-0" : ""}`}
    >
      <div
        className="flex min-h-16 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 py-2 sm:px-5"
      >
      <div className="flex min-w-0 flex-1 basis-40 items-center gap-2">
          {renderBackControl()}
          {slideCourse && (
            <span className="hidden size-8 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600 sm:grid">
              <Presentation size={17} strokeWidth={1.75} aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-indigo-600">
              {slideCourse ? "Presentation editor" : "Coursecraft authoring"}
            </p>
            <p className="truncate text-sm font-semibold">
              {lessonTitle ?? courseTitle}
            </p>
          </div>
        </div>

        <div
          role="group"
          aria-label={slideCourse ? "Presentation editor actions" : "Standard editor actions"}
          className="flex max-w-full shrink-0 items-center gap-1"
        >
          {saveStatus}
          {canManageBlocks && (
            <Button
              type="button"
              variant={blockManagerOpen ? "secondary" : "ghost"}
              size="sm"
              aria-label="Manage blocks"
              aria-expanded={blockManagerOpen}
              aria-controls="lesson-block-manager"
              onClick={onToggleBlockManager}
              title="Manage blocks"
              className="size-8 min-h-0 rounded-md p-0 text-slate-600"
            >
              <List size={16} aria-hidden="true" />
              <span className="sr-only">Manage blocks</span>
            </Button>
          )}
          <CourseThemeSettings
            courseId={courseId}
            courseTitle={courseTitle}
            theme={theme}
            compact
            onChange={onThemeChange}
          />
          <CourseNavigationSettings
            navigationMode={navigationMode}
            compact
            onChange={onNavigationModeChange}
          />
          <div
            role="group"
            aria-label="Edit history"
            className="mx-1 flex items-center border-x border-slate-200 px-1"
          >
            <Button
              variant="ghost"
              size="icon"
              disabled={!canUndo}
              onClick={onUndo}
              aria-label="Undo"
              title="Undo"
              className="size-8 rounded-md text-slate-500"
            >
              <Undo2 size={16} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={!canRedo}
              onClick={onRedo}
              aria-label="Redo"
              title="Redo"
              className="size-8 rounded-md text-slate-500"
            >
              <Redo2 size={16} />
            </Button>
          </div>
          <Button
            type="button"
            variant="default"
            size="sm"
            aria-label="Preview"
            title={slideCourse ? "Preview presentation" : "Preview course"}
            className="size-8 min-h-0 rounded-md p-0 shadow-none"
            onClick={onPreview}
          >
            <Eye size={16} aria-hidden="true" />
            <span className="sr-only">Preview</span>
          </Button>
        </div>
      </div>
      {(saveState === "error" || saveState === "conflict") && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 border-t border-rose-100 bg-rose-50 px-4 py-2 text-xs text-rose-800 sm:px-6"
        >
          <span>{saveMessage}</span>
          {saveState === "conflict" ? (
            <Button size="sm" variant="outline" onClick={onReloadCourse}>
              Reload course
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={onRetrySave}>
              Retry save
            </Button>
          )}
        </div>
      )}
    </header>
  );
}
