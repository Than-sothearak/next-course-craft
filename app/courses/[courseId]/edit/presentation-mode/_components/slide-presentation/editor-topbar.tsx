"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, Eye, List, Presentation, Redo2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CourseNavigationMode } from "@/lib/editor/navigation";
import type { CourseTheme } from "@/lib/editor/theme";
import { editorModeHref } from "@/lib/editor/course-routes";
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
  onReloadCourse,
}: Props) {
  return (
    <header
      data-presentation-editor-header={slideCourse || undefined}
      className={`sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur ${isPresentationWorkspace ? "shrink-0" : ""}`}
    >
      <div
        className={
          slideCourse
            ? "flex min-h-16 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 py-2 sm:px-5"
            : "flex min-h-[68px] flex-wrap items-center justify-between gap-4 px-4 py-2 sm:px-6 sm:py-0"
        }
      >
        <div
          className={
            slideCourse
              ? "flex min-w-0 flex-1 basis-40 items-center gap-2"
              : "flex min-w-0 items-center gap-3"
          }
        >
          {hasActiveLesson && !focusedLessonId ? (
            <button
              type="button"
              onClick={onBackToOutline}
              aria-label={
                slideCourse ? "Presentation settings" : "Back to course outline"
              }
              className="cursor-pointer grid size-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            >
              <ArrowLeft size={18} />
            </button>
          ) : (
            <Link
              href={
                focusedLessonId
                  ? editorModeHref(courseId, slideCourse ? "presentation" : "standard")
                  : "/dashboard"
              }
              aria-label={focusedLessonId ? "Back to course" : "Back to dashboard"}
              className="grid size-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            >
              <ArrowLeft size={18} />
            </Link>
          )}
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
          aria-label={slideCourse ? "Presentation editor actions" : undefined}
          className={
            slideCourse
              ? "flex max-w-full shrink-0 items-center gap-1"
              : "flex max-w-full flex-wrap items-center gap-1 sm:gap-2"
          }
        >
          {saveStatus}
          {canManageBlocks && (
            <Button
              type="button"
              variant={blockManagerOpen ? "secondary" : slideCourse ? "ghost" : "outline"}
              size="sm"
              aria-label="Manage blocks"
              aria-expanded={blockManagerOpen}
              aria-controls="lesson-block-manager"
              onClick={onToggleBlockManager}
              className={slideCourse ? "size-8 min-h-0 rounded-md p-0 text-slate-600" : "h-9 px-2 sm:px-3"}
            >
              <List size={16} aria-hidden="true" />
              <span className={slideCourse ? "sr-only" : "hidden sm:inline"}>
                Manage blocks
              </span>
            </Button>
          )}
          <CourseThemeSettings
            courseId={courseId}
            courseTitle={courseTitle}
            theme={theme}
            compact={slideCourse}
            onChange={onThemeChange}
          />
          <CourseNavigationSettings
            navigationMode={navigationMode}
            compact={slideCourse}
            onChange={onNavigationModeChange}
          />
          <div
            role="group"
            aria-label="Edit history"
            className={slideCourse ? "mx-1 flex items-center border-x border-slate-200 px-1" : "flex items-center"}
          >
            <Button
              variant="ghost"
              size="icon"
              disabled={!canUndo}
              onClick={onUndo}
              aria-label="Undo"
              title="Undo"
              className={slideCourse ? "size-8 rounded-md text-slate-500" : undefined}
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
              className={slideCourse ? "size-8 rounded-md text-slate-500" : undefined}
            >
              <Redo2 size={16} />
            </Button>
          </div>
          <Button
            type="button"
            variant={slideCourse ? "default" : "outline"}
            size="sm"
            aria-label="Preview"
            title={slideCourse ? "Preview presentation" : "Preview course"}
            className={slideCourse ? "size-8 min-h-0 rounded-md p-0 shadow-none" : undefined}
            onClick={onPreview}
          >
            <Eye size={16} aria-hidden="true" />
            <span className={slideCourse ? "sr-only" : undefined}>Preview</span>
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
