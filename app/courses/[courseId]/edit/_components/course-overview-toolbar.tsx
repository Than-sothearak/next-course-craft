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
        <div className="flex items-center gap-2">
          {saveStatus}
          {slideCourse && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Undo"
                disabled={!canUndo}
                onClick={onUndo}
              >
                <Undo2 size={16} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Redo"
                disabled={!canRedo}
                onClick={onRedo}
              >
                <Redo2 size={16} />
              </Button>
            </>
          )}
          {canGenerate && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="Generate content"
              title="Generate content"
              onClick={onGenerate}
            >
              <Sparkles size={15} />
              <span className="hidden sm:inline">Generate content</span>
              <span className="sm:hidden">Generate</span>
            </Button>
          )}
          <CourseThemeSettings
            courseId={courseId}
            courseTitle={title}
            theme={theme}
            onChange={onThemeChange}
          />
          <CourseNavigationSettings
            navigationMode={navigationMode}
            onChange={onNavigationModeChange}
          />
          {canPublish && (
            <PublishMenu
              courseId={courseId}
              title={title}
              disabled={Boolean(publishDisabledReason)}
              disabledReason={publishDisabledReason}
            />
          )}
          <Button type="button" variant="outline" size="sm" onClick={onPreview}>
            <Eye size={15} />
            Preview
          </Button>
        </div>
      }
    />
  );
}
