"use client";

import { type CSSProperties, useMemo, useState } from "react";
import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { defaultCourseNavigationMode } from "@/lib/editor/navigation";
import { MediaProgressProvider, useMediaProgress } from "@/components/media-progress-context";
import {
  canNavigateToLesson,
  getInitiallyViewedInteractionIds,
  getPendingInteractiveProgressIds,
  getPendingRequiredContinueDividerIds,
  type LearnerProgressAdapter,
} from "@/lib/export/progress";
import {
  courseThemeFontFamilies,
  normalizeCourseTheme,
} from "@/lib/editor/theme";
import { LessonMenu } from "./_components/(course_preview_components)/lesson-menu";
import { CourseOverviewPreview } from "./_components/(course_preview_components)/course-overview-preview";
import { PreviewToolbar } from "./_components/(course_preview_components)/preview-toolbar";
import { LessonReaderPreview } from "./_components/(course_preview_components)/lesson-reader-preview";
import { PreviewViewport } from "./_components/(course_preview_components)/preview-viewport";
import { SlidePresentationPreview } from "./presentation-mode/_components/slide-presentation/slide-presentation-preview";
import { previewEditTarget } from "./_components/(course_preview_components)/preview-edit-target";
import { useCoursePreviewProgress } from "./_components/use-course-preview-progress";
import type {
  PreviewData,
  PreviewDevice,
  PreviewMode,
  PreviewOrientation,
  PreviewEditTarget,
} from "./_components/(course_preview_components)/preview-types";
export type { PreviewData } from "./_components/(course_preview_components)/preview-types";
export { QuizAssessmentPreview } from "./_components/(course_preview_components)/(lesson_reader_preview_components)/quiz-assessment-preview";

function authorInitials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "CA"
  );
}

type CoursePreviewProps = {
  initialData: PreviewData;
  authorName: string;
  initialLessonId?: string;
  standalone?: boolean;
  onEdit?: (target?: PreviewEditTarget) => void;
  progressAdapter?: LearnerProgressAdapter;
  persistLocalProgress?: boolean;
  canPublish?: boolean;
  onBack?: () => void;
};

export function CoursePreview(props: CoursePreviewProps) {
  return <MediaProgressProvider key={props.initialData.courseId}><CoursePreviewContent {...props} /></MediaProgressProvider>;
}

function CoursePreviewContent({
  initialData,
  authorName,
  initialLessonId,
  standalone = false,
  onEdit,
  progressAdapter,
  persistLocalProgress = true,
  canPublish = true,
  onBack,
}: CoursePreviewProps) {
  const { mediaProgress, restoreMediaProgress } = useMediaProgress();
  const slideCourse = initialData.courseLayout === "slides";
  const firstSlideId = slideCourse
    ? ([...initialData.sections]
        .sort((a, b) => a.order - b.order)
        .flatMap((section) =>
          initialData.lessons
            .filter((lesson) => lesson.sectionId === section.id)
            .sort((a, b) => a.order - b.order),
        )[0]?.id ?? null)
    : null;
  const [mode, setMode] = useState<PreviewMode>(
    initialLessonId || slideCourse ? "learn" : "course",
  );
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const [orientation, setOrientation] =
    useState<PreviewOrientation>("portrait");
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(
    initialLessonId ?? firstSlideId,
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [lessonSearch, setLessonSearch] = useState("");
  const [collapsedSectionIds, setCollapsedSectionIds] = useState<Set<string>>(
    () => new Set(),
  );
  const navigationMode =
    initialData.navigationMode ?? defaultCourseNavigationMode;

  const courseTheme = normalizeCourseTheme(initialData.theme);
  const themeStyle = {
    "--course-primary": courseTheme.primaryColor,
    "--course-accent": courseTheme.accentColor,
  } as CSSProperties;
  const sections = useMemo(
    () => [...initialData.sections].sort((a, b) => a.order - b.order),
    [initialData.sections],
  );
  const lessons = useMemo(
    () =>
      sections.flatMap((section) =>
        initialData.lessons
          .filter((lesson) => lesson.sectionId === section.id)
          .sort((a, b) => a.order - b.order),
      ),
    [initialData.lessons, sections],
  );
  const progressState = useCoursePreviewProgress({
    courseId: initialData.courseId,
    lessons,
    slideCourse,
    initialLessonId,
    firstSlideId,
    navigationMode,
    mode,
    selectedLessonId,
    setSelectedLessonId,
    progressAdapter,
    persistLocalProgress,
    mediaProgress,
    restoreMediaProgress,
  });
  const {
    lessonBodyScrollRefs,
    visitedLessonIds,
    setVisitedLessonIds,
    lessonScrollProgress,
    setLessonScrollProgress,
    quizScores,
    setQuizScores,
    passedQuizIds,
    setPassedQuizIds,
    revealedDividerIds,
    setRevealedDividerIds,
    completedDividerIds,
    unlockingDividerIds,
    setUnlockingDividerIds,
    interactedContentIds,
    setInteractedContentIds,
    setPendingContinueScroll,
    completedLessonIds,
    progress,
    completedLessonCount,
    slideMediaDurations,
    recordSlideMediaDuration,
    markContentAboveComplete,
  } = progressState;

  const selectedLesson =
    lessons.find((lesson) => lesson.id === selectedLessonId) ?? null;
  const lessonIndex = selectedLesson
    ? lessons.findIndex((lesson) => lesson.id === selectedLesson.id)
    : -1;
  const initials = authorInitials(authorName);
  const useMobileMenu = device === "mobile" || isMobileViewport;
  const lessonMenuProps = {
    initialData,
    progress,
    completedLessonCount,
    lessons,
    sections,
    device,
    sidebarCollapsed,
    collapsedSectionIds,
    lessonSearch,
    selectedLesson,
    lessonScrollProgress,
    slideMediaDurations,
    visitedLessonIds: completedLessonIds,
    getLessonNavigationLockMessage,
    selectLesson,
    setCollapsedSectionIds,
    setLessonSearch,
    setMobileMenuOpen,
  };

  function selectLesson(lessonId: string) {
    if (getLessonNavigationLockMessage(lessonId)) return;
    const lesson = lessons.find((item) => item.id === lessonId);
    setLessonSearch("");
    if (lesson) {
      setCollapsedSectionIds((previous) => {
        if (!previous.has(lesson.sectionId)) return previous;
        const next = new Set(previous);
        next.delete(lesson.sectionId);
        return next;
      });
    }
    if (!slideCourse && lesson && lesson.lessonType !== "quiz") {
      const initiallyViewedIds = getInitiallyViewedInteractionIds(
        lesson.blocks,
      );
      if (initiallyViewedIds.length) {
        setInteractedContentIds((previous) => {
          const next = new Set(previous);
          initiallyViewedIds.forEach((id) => next.add(id));
          return next;
        });
      }
    }
    setSelectedLessonId(lessonId);
    setMode("learn");
    setMobileMenuOpen(false);
  }

  function getLessonNavigationLockMessage(lessonId: string) {
    if (navigationMode === "free") return null;
    const targetIndex = lessons.findIndex((lesson) => lesson.id === lessonId);
    if (!selectedLesson) {
      return targetIndex === 0
        ? null
        : `Start with the first ${slideCourse ? "slide" : "lesson"} before continuing.`;
    }
    const completionLockMessage =
      navigationMode === "sequential"
        ? getSequentialNavigationLockMessage(selectedLesson)
        : getRestrictedNavigationLockMessage(selectedLesson);
    const canContinue = !completionLockMessage;
    const targetPrerequisitesComplete =
      targetIndex > 0 &&
      lessons
        .slice(0, targetIndex)
        .every((lesson) => visitedLessonIds.has(lesson.id));
    if (
      canNavigateToLesson(
        lessonIndex,
        targetIndex,
        canContinue,
        visitedLessonIds.has(lessonId) || targetPrerequisitesComplete,
        navigationMode,
      )
    )
      return null;
    if (completionLockMessage) return completionLockMessage;
    return navigationMode === "sequential"
      ? `Complete ${slideCourse ? "slides" : "lessons"} in order. Continue with the next ${slideCourse ? "slide" : "lesson"}.`
      : `Complete required activities before opening the next ${slideCourse ? "slide" : "lesson"}.`;
  }

  function getSequentialNavigationLockMessage(
    lesson: (typeof lessons)[number],
  ) {
    if (lesson.lessonType === "quiz") {
      if (!passedQuizIds.has(lesson.id))
        return "Pass the current quiz before opening the next lesson.";
      return null;
    }
    return visitedLessonIds.has(lesson.id)
      ? null
      : `Complete the current ${slideCourse ? "slide" : "lesson"} before opening the next one.`;
  }

  function getRestrictedNavigationLockMessage(
    lesson: (typeof lessons)[number],
  ) {
    if (lesson.lessonType === "quiz") {
      return passedQuizIds.has(lesson.id)
        ? null
        : "Pass the quiz in the current lesson before continuing.";
    }
    const pendingDividerIds = getPendingRequiredContinueDividerIds(
      lesson.blocks,
      revealedDividerIds,
      completedDividerIds,
      interactedContentIds,
    );
    const dividerId = pendingDividerIds[0];
    if (dividerId) {
      const dividerIndex = lesson.blocks.findIndex(
        (block) => block.id === dividerId,
      );
      if (
        getPendingInteractiveProgressIds(
          lesson.blocks,
          interactedContentIds,
          dividerIndex,
        ).length > 0
      ) {
        return "Complete each interactive activity above the Continue button before moving on.";
      }
      if (!completedDividerIds.has(dividerId))
        return "Read through the content above the Continue button to unlock it.";
      return "Use the Continue button to unlock the next content.";
    }

    const pendingInteractiveIds = getPendingInteractiveProgressIds(
      lesson.blocks,
      interactedContentIds,
    );
    if (pendingInteractiveIds.length)
      return `Complete each required activity in this ${slideCourse ? "slide" : "lesson"} before continuing.`;
    return null;
  }

  function startLearning() {
    setMode("learn");
    if (!selectedLesson && lessons[0]) selectLesson(lessons[0].id);
  }

  function editCurrentContent() {
    const target =
      mode === "learn"
        ? previewEditTarget(
            selectedLessonId,
            selectedLessonId
              ? lessonBodyScrollRefs.current.get(selectedLessonId)
              : null,
          )
        : undefined;
    onEdit?.(target);
  }

  const lessonReaderProps = {
    initialData,
    slideLayout: initialData.courseLayout === "slides",
    active: mode === "learn",
    lessons,
    selectedLessonId,
    device: isMobileViewport ? ("mobile" as const) : device,
    orientation,
    authorName,
    initials,
    quizScores,
    passedQuizIds,
    visitedLessonIds,
    revealedDividerIds,
    completedDividerIds,
    unlockingDividerIds,
    interactedContentIds,
    navigationMode,
    lessonBodyScrollRefs,
    markContentAboveComplete,
    selectLesson,
    returnToCourse: () => setMode("course"),
    getLessonNavigationLockMessage,
    setQuizScores,
    setPassedQuizIds,
    setLessonScrollProgress,
    setVisitedLessonIds,
    setRevealedDividerIds,
    setPendingContinueScroll,
    setInteractedContentIds,
    setUnlockingDividerIds,
    onMediaDurationChange: recordSlideMediaDuration,
  };

  if (slideCourse) {
    return (
      <main
        style={{
          ...themeStyle,
          fontFamily: courseThemeFontFamilies[courseTheme.fontFamily],
        }}
        className="h-dvh min-h-0 w-full min-w-0 overflow-hidden"
      >
        <SlidePresentationPreview
          courseId={initialData.courseId}
          title={initialData.title}
          navigationGuide={initialData.slideMaster?.navigationGuide}
          slides={lessons}
          selectedId={selectedLessonId}
          onSelect={selectLesson}
          getLockMessage={getLessonNavigationLockMessage}
          menuOpen={mobileMenuOpen}
          onMenuOpenChange={setMobileMenuOpen}
          menu={<LessonMenu {...lessonMenuProps} mobile />}
          standalone={standalone}
          canPublish={canPublish}
          onBack={onBack}
          onEdit={onEdit ? editCurrentContent : undefined}
        >
          <LessonReaderPreview {...lessonReaderProps} />
        </SlidePresentationPreview>
      </main>
    );
  }

  return (
    <main
      style={themeStyle}
      className="flex h-dvh min-h-0 w-full min-w-0 flex-col overflow-hidden bg-slate-100 text-slate-900"
    >
      <PreviewToolbar
        standalone={standalone}
        canPublish={canPublish}
        onBack={onBack}
        onEdit={onEdit ? editCurrentContent : undefined}
        mode={mode}
        device={device}
        orientation={orientation}
        courseId={initialData.courseId}
        courseTitle={initialData.title}
        onModeChange={setMode}
        onStartLearning={startLearning}
        onDeviceChange={(nextDevice) => {
          setDevice(nextDevice);
          setMobileMenuOpen(false);
        }}
        onOrientationChange={setOrientation}
      />

      <PreviewViewport
        device={device}
        orientation={orientation}
        fontFamily={courseThemeFontFamilies[courseTheme.fontFamily]}
        onCompactChange={setIsMobileViewport}
      >
        {mode === "course" && (
          <CourseOverviewPreview
            initialData={initialData}
            authorName={authorName}
            initials={initials}
            device={device}
            lessons={lessons}
            sections={sections}
            startLearning={startLearning}
            selectLesson={selectLesson}
            getLessonNavigationLockMessage={getLessonNavigationLockMessage}
          />
        )}
        {(selectedLessonId || mode === "learn") && (
          <div
            aria-hidden={mode !== "learn"}
            className={
              mode === "learn"
                ? "relative flex h-full min-h-0 min-w-0"
                : "hidden"
            }
          >
            {!useMobileMenu && initialData.courseLayout !== "slides" && (
              <LessonMenu {...lessonMenuProps} />
            )}
            {useMobileMenu && mobileMenuOpen && (
              <div className="absolute inset-x-0 bottom-0 top-12 z-40 flex">
                <button
                  type="button"
                  aria-label="Close course menu"
                  onClick={() => setMobileMenuOpen(false)}
                  className="cursor-pointer absolute inset-0 bg-slate-950/40"
                />
                <LessonMenu {...lessonMenuProps} mobile />
              </div>
            )}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              <div className="relative z-10 flex min-h-12 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
                {useMobileMenu ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Open course menu"
                    aria-expanded={mobileMenuOpen}
                    onClick={() => setMobileMenuOpen(true)}
                    className="size-8"
                  >
                    <Menu size={18} />
                  </Button>
                ) : initialData.courseLayout === "slides" ? null : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={
                      sidebarCollapsed
                        ? "Expand course menu"
                        : "Collapse course menu"
                    }
                    aria-expanded={!sidebarCollapsed}
                    onClick={() =>
                      setSidebarCollapsed((collapsed) => !collapsed)
                    }
                    className="size-8"
                  >
                    <PanelLeftOpen
                      size={17}
                      className={sidebarCollapsed ? "" : "hidden"}
                    />
                    <PanelLeftClose
                      size={17}
                      className={sidebarCollapsed ? "hidden" : ""}
                    />
                  </Button>
                )}
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-600">
                  {initialData.title}
                </span>
                <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {selectedLesson
                    ? `${lessonIndex + 1} / ${lessons.length}`
                    : "Course content"}
                </span>
              </div>
              <LessonReaderPreview {...lessonReaderProps} />
            </div>
          </div>
        )}
      </PreviewViewport>
    </main>
  );
}
