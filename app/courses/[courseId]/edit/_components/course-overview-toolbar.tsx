"use client";

import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, Eye, Redo2, Sparkles, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublishMenu } from "@/components/publish-menu";
import { DashboardNavbar } from "@/app/dashboard/_components/dashboard-navbar";
import type { Permission } from "@/lib/auth/policy";
import type { Draft } from "./_components/use-editor-draft";
import { CourseNavigationSettings } from "./(editor_client_components)/course-navigation-settings";
import { CourseThemeSettings } from "./(editor_client_components)/course-theme-settings";

type CourseOverviewToolbarProps = {
  courseId: string;
  title: string;
  theme: Draft["theme"];
  navigationMode: Draft["navigationMode"];
  globalPermissions: Permission[];
  userName: string;
  saveStatus: ReactNode;
  canUndo: boolean;
  canRedo: boolean;
  slideCourse: boolean;
  canGenerate: boolean;
  canPublish: boolean;
  publishDisabledReason?: string;
  onBack: () => void;
  onForward: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onGenerate: () => void;
  onThemeChange: (theme: Draft["theme"]) => void;
  onNavigationModeChange: (mode: Draft["navigationMode"]) => void;
  onPreview: () => void;
};

export function CourseOverviewToolbar({
  courseId,
  title,
  theme,
  navigationMode,
  globalPermissions,
  userName,
  saveStatus,
  canUndo,
  canRedo,
  slideCourse,
  canGenerate,
  canPublish,
  publishDisabledReason,
  onBack,
  onForward,
  onUndo,
  onRedo,
  onGenerate,
  onThemeChange,
  onNavigationModeChange,
  onPreview,
}: CourseOverviewToolbarProps) {
  return (
    <DashboardNavbar
      permissions={globalPermissions}
      userName={userName}
      actions={
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onBack}
            aria-label="Back"
            title="Back"
          >
            <ArrowLeft size={17} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onForward}
            aria-label="Forward"
            title="Forward"
          >
            <ArrowRight size={17} />
          </Button>
        </>
      }
      primaryAction={
        <div role="group" aria-label="Course editor actions" className="flex items-center gap-1">
          {saveStatus}
          {canGenerate && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Generate content"
              title="Generate content"
              className="size-8 rounded-md text-slate-600"
              onClick={onGenerate}
            >
              <Sparkles size={16} />
            </Button>
          )}
          <CourseThemeSettings
            courseId={courseId}
            courseTitle={title}
            theme={theme}
            compact
            onChange={onThemeChange}
          />
          <CourseNavigationSettings
            navigationMode={navigationMode}
            compact
            onChange={onNavigationModeChange}
          />
          {canPublish && (
            <PublishMenu
              courseId={courseId}
              title={title}
              disabled={Boolean(publishDisabledReason)}
              disabledReason={publishDisabledReason}
              compact
            />
          )}
          {!slideCourse && (
            <div role="group" aria-label="Edit history" className="mx-1 flex items-center border-x border-slate-200 px-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Undo"
                title="Undo"
                disabled={!canUndo}
                className="size-8 rounded-md text-slate-500"
                onClick={onUndo}
              >
                <Undo2 size={16} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Redo"
                title="Redo"
                disabled={!canRedo}
                className="size-8 rounded-md text-slate-500"
                onClick={onRedo}
              >
                <Redo2 size={16} />
              </Button>
            </div>
          )}
          <Button type="button" variant="default" size="icon" aria-label="Preview" title="Preview course" className="size-8 min-h-0 rounded-md p-0 shadow-none" onClick={onPreview}>
            <Eye size={16} aria-hidden="true" />
          </Button>
        </div>
      }
    />
  );
}
