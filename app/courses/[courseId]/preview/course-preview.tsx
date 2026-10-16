"use client";

import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { defaultCourseNavigationMode } from "@/lib/editor/navigation";
import { getCourseProgress } from "@/lib/editor/preview";
import {
  canNavigateToLesson,
  canCompleteLesson,
  getFlipCardProgressId,
  getInitiallyViewedInteractionIds,
  getPendingInteractiveProgressIds,
  getPendingRequiredContinueDividerIds,
  getLessonReadingProgress,
  hasReachedContentEnd,
  type LearnerProgressAdapter,
  type LearnerProgressSnapshot,
} from "@/lib/export/progress";
import { courseThemeFontFamilies, normalizeCourseTheme } from "@/lib/editor/theme";
import { LessonMenu } from "./_components/(course_preview_components)/lesson-menu";
import { CourseOverviewPreview } from "./_components/(course_preview_components)/course-overview-preview";
import { PreviewToolbar } from "./_components/(course_preview_components)/preview-toolbar";
import { LessonReaderPreview } from "./_components/(course_preview_components)/lesson-reader-preview";
import { PreviewViewport } from "./_components/(course_preview_components)/preview-viewport";
import { previewEditTarget } from "./_components/(course_preview_components)/preview-edit-target";
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

export function CoursePreview({
  initialData,
  authorName,
  initialLessonId,
  standalone = false,
  onEdit,
  progressAdapter,
  persistLocalProgress = true,
  canPublish = true,
  onBack,
}: {
  initialData: PreviewData;
  authorName: string;
  initialLessonId?: string;
  standalone?: boolean;
  onEdit?: (target?: PreviewEditTarget) => void;
  progressAdapter?: LearnerProgressAdapter;
  persistLocalProgress?: boolean;
  canPublish?: boolean;
  onBack?: () => void;
}) {
  const [mode, setMode] = useState<PreviewMode>(initialLessonId ? "learn" : "course");
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const [orientation, setOrientation] = useState<PreviewOrientation>("portrait");
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(initialLessonId ?? null);
  const [visitedLessonIds, setVisitedLessonIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [lessonScrollProgress, setLessonScrollProgress] = useState<
    Record<string, number>
  >({});
  const [quizScores, setQuizScores] = useState<Record<string, number>>({});
  const [passedQuizIds, setPassedQuizIds] = useState<Set<string>>(new Set());
  const [progressLoadedCourseId, setProgressLoadedCourseId] = useState<
    string | null
  >(null);
  const [revealedDividerIds, setRevealedDividerIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [completedDividerIds, setCompletedDividerIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [unlockingDividerIds, setUnlockingDividerIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [interactedContentIds, setInteractedContentIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [pendingContinueScroll, setPendingContinueScroll] = useState<{
    lessonId: string;
    blockId: string;
  } | null>(null);
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
  const lessonBodyScrollRefs = useRef<Map<string, HTMLDivElement>>(new Map());
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
  const flipCardProgressIds = useMemo(
    () =>
      new Set(
        lessons.flatMap((lesson) =>
          lesson.blocks.flatMap((block) =>
            block.type === "flipCard"
              ? block.data.cards.map((card) =>
                  getFlipCardProgressId(block.id, card.id),
                )
              : [],
          ),
        ),
      ),
    [lessons],
  );
  const selectedLesson =
    lessons.find((lesson) => lesson.id === selectedLessonId) ?? null;
  const lessonIndex = selectedLesson
    ? lessons.findIndex((lesson) => lesson.id === selectedLesson.id)
    : -1;
  const progress = getCourseProgress(
    visitedLessonIds,
    lessons.map((lesson) => lesson.id),
  );
  const visitedLessonCount = lessons.filter((lesson) =>
    visitedLessonIds.has(lesson.id),
  ).length;
  const initials = authorInitials(authorName);
  const useMobileMenu = device === "mobile" || isMobileViewport;
  const lessonMenuProps = {
    initialData,
    progress,
    visitedLessonCount,
    lessons,
    sections,
    device,
    sidebarCollapsed,
    collapsedSectionIds,
    lessonSearch,
    selectedLesson,
    lessonScrollProgress,
    visitedLessonIds,
    getLessonNavigationLockMessage,
    selectLesson,
    setCollapsedSectionIds,
    setLessonSearch,
    setMobileMenuOpen,
  };

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        let snapshot: LearnerProgressSnapshot | null = progressAdapter?.load(initialData.courseId) ?? null;
        if (!progressAdapter && persistLocalProgress) {
          const stored = window.localStorage.getItem(
            `coursecraft-progress-v2-${initialData.courseId}`,
          );
          const parsed = stored ? JSON.parse(stored) as LearnerProgressSnapshot | string[] : null;
          snapshot = Array.isArray(parsed)
            ? { visitedLessonIds: parsed, lessonScrollProgress: {}, revealedDividerIds: [], completedDividerIds: [], selectedLessonId: null }
            : parsed;
        }
        setVisitedLessonIds(new Set(snapshot?.visitedLessonIds ?? []));
        setLessonScrollProgress(snapshot?.lessonScrollProgress ?? {});
        setQuizScores(snapshot?.quizScores ?? {});
        const restoredPassedQuizIds = snapshot?.passedQuizIds ?? lessons
          .filter((lesson) => lesson.lessonType === "quiz" && snapshot?.visitedLessonIds?.includes(lesson.id))
          .map((lesson) => lesson.id);
        setPassedQuizIds(new Set(restoredPassedQuizIds));
        setRevealedDividerIds(new Set(snapshot?.revealedDividerIds ?? []));
        setCompletedDividerIds(new Set(snapshot?.completedDividerIds ?? []));
        setUnlockingDividerIds(new Set());
        const resumedLesson = lessons.find(
          (lesson) => lesson.id === snapshot?.selectedLessonId,
        );
        const selectedPreviewLesson = lessons.find(
          (lesson) => lesson.id === initialLessonId,
        );
        const progressLesson = selectedPreviewLesson ?? resumedLesson;
        setInteractedContentIds(
          new Set([
            ...(snapshot?.interactedContentIds ?? []),
            ...(snapshot?.interactedFlipCardIds ?? []),
            ...(progressLesson && progressLesson.lessonType !== "quiz"
              ? getInitiallyViewedInteractionIds(progressLesson.blocks)
              : []),
          ]),
        );
        setSelectedLessonId(
          (current) => current ?? snapshot?.selectedLessonId ?? null,
        );
      } catch {
        setVisitedLessonIds(new Set());
        setLessonScrollProgress({});
        setQuizScores({});
        setPassedQuizIds(new Set());
        setRevealedDividerIds(new Set());
        setCompletedDividerIds(new Set());
        setInteractedContentIds(new Set());
      } finally {
        setProgressLoadedCourseId(initialData.courseId);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [initialData.courseId, initialLessonId, lessons, persistLocalProgress, progressAdapter]);

  useEffect(() => {
    if (progressLoadedCourseId !== initialData.courseId) return;
    if (progressAdapter) {
      progressAdapter.save(
        initialData.courseId,
        {
          visitedLessonIds: [...visitedLessonIds],
          lessonScrollProgress,
          revealedDividerIds: [...revealedDividerIds],
          completedDividerIds: [...completedDividerIds],
          interactedFlipCardIds: [...interactedContentIds].filter((id) =>
            flipCardProgressIds.has(id),
          ),
          interactedContentIds: [...interactedContentIds],
          selectedLessonId,
          quizScores,
          passedQuizIds: [...passedQuizIds],
        },
        progress === 100,
      );
      return;
    }
    if (!persistLocalProgress) return;
    try {
      window.localStorage.setItem(
        `coursecraft-progress-v2-${initialData.courseId}`,
        JSON.stringify({
          visitedLessonIds: [...visitedLessonIds],
          lessonScrollProgress,
          revealedDividerIds: [...revealedDividerIds],
          completedDividerIds: [...completedDividerIds],
          interactedFlipCardIds: [...interactedContentIds].filter((id) =>
            flipCardProgressIds.has(id),
          ),
          interactedContentIds: [...interactedContentIds],
          selectedLessonId,
          quizScores,
          passedQuizIds: [...passedQuizIds],
        }),
      );
    } catch {
      // Standalone file URLs may not allow local storage.
    }
  }, [
    initialData.courseId,
    progress,
    persistLocalProgress,
    progressAdapter,
    progressLoadedCourseId,
    visitedLessonIds,
    lessonScrollProgress,
    quizScores,
    passedQuizIds,
    revealedDividerIds,
    completedDividerIds,
    interactedContentIds,
    flipCardProgressIds,
    selectedLessonId,
  ]);

  const markContentAboveComplete = useCallback(
    (lesson: (typeof lessons)[number], element: HTMLDivElement) => {
      if (lesson.lessonType === "quiz") {
        if (passedQuizIds.has(lesson.id)) {
          setLessonScrollProgress((previous) => previous[lesson.id] === 100 ? previous : { ...previous, [lesson.id]: 100 });
          setVisitedLessonIds((previous) => previous.has(lesson.id) ? previous : new Set(previous).add(lesson.id));
        }
        return;
      }
      const divider = lesson.blocks.find((block) =>
        block.type === "divider" &&
        block.data.style === "continue" &&
        (!revealedDividerIds.has(block.id) ||
          (block.data.completionType === "completeAbove" &&
            !completedDividerIds.has(block.id))),
      );
      const continueDividers = lesson.blocks.filter(
        (block) => block.type === "divider" && block.data.style === "continue",
      );
      const revealedContinueCount = continueDividers.filter((block) =>
        revealedDividerIds.has(block.id),
      ).length;
      const reachedEnd = hasReachedContentEnd(element);
      const hasPendingInteractiveContent = navigationMode !== "free" && getPendingInteractiveProgressIds(
        lesson.blocks,
        interactedContentIds,
      ).length > 0;
      const readingProgress = getLessonReadingProgress({
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
        scrollTop: element.scrollTop,
        revealedContinueCount,
        totalContinueCount: continueDividers.length,
      });
      const trackedProgress = hasPendingInteractiveContent
        ? Math.min(readingProgress, 99)
        : readingProgress;
      setLessonScrollProgress((previous) =>
        previous[lesson.id] === trackedProgress
          ? previous
          : { ...previous, [lesson.id]: trackedProgress },
      );
      if (!reachedEnd) return;
      if (divider?.type === "divider") {
        const dividerIndex = lesson.blocks.findIndex(
          (block) => block.id === divider.id,
        );
        const hasPendingInteractiveContentAboveDivider = getPendingInteractiveProgressIds(
          lesson.blocks,
          interactedContentIds,
          dividerIndex,
        ).length > 0;
        if (
          divider.data.completionType === "completeAbove" &&
          !hasPendingInteractiveContentAboveDivider &&
          !completedDividerIds.has(divider.id)
        ) {
          setCompletedDividerIds((previous) =>
            new Set(previous).add(divider.id),
          );
          setUnlockingDividerIds((previous) => new Set(previous).add(divider.id));
        }
        return;
      }
      if (
        canCompleteLesson({
          scrollHeight: element.scrollHeight,
          clientHeight: element.clientHeight,
          scrollTop: element.scrollTop,
          hasPendingContinue: hasPendingInteractiveContent,
        })
      ) {
        setVisitedLessonIds((previous) =>
          previous.has(lesson.id) ? previous : new Set(previous).add(lesson.id),
        );
      }
    },
    [completedDividerIds, interactedContentIds, navigationMode, passedQuizIds, revealedDividerIds],
  );

  useEffect(() => {
    if (mode !== "learn") return;
    const lesson = lessons.find((item) => item.id === selectedLessonId);
    const element = lesson
      ? lessonBodyScrollRefs.current.get(lesson.id)
      : undefined;
    if (!lesson || !element) return;
    const update = () => { if (element.clientHeight > 0) markContentAboveComplete(lesson, element); };
    const frame = window.requestAnimationFrame(update);
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(update);
    observer?.observe(element);
    return () => { window.cancelAnimationFrame(frame); observer?.disconnect(); };
  }, [mode, selectedLessonId, revealedDividerIds, interactedContentIds, lessons, markContentAboveComplete]);

  useEffect(() => {
    if (!pendingContinueScroll || mode !== "learn") return;
    const frame = window.requestAnimationFrame(() => {
      if (pendingContinueScroll.lessonId === selectedLessonId) {
        const container = lessonBodyScrollRefs.current.get(
          pendingContinueScroll.lessonId,
        );
        const target =
          container &&
          Array.from(
            container.querySelectorAll<HTMLElement>("[data-lesson-block-id]"),
          ).find(
            (element) =>
              element.dataset.lessonBlockId === pendingContinueScroll.blockId,
          );
        if (container && target) {
          const top =
            target.getBoundingClientRect().top -
            container.getBoundingClientRect().top +
            container.scrollTop -
            16;
          container.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
        }
      }
      setPendingContinueScroll(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [mode, pendingContinueScroll, revealedDividerIds, selectedLessonId]);

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
    if (lesson && lesson.lessonType !== "quiz") {
      const initiallyViewedIds = getInitiallyViewedInteractionIds(lesson.blocks);
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
        : "Start with the first lesson before continuing.";
    }
    const completionLockMessage = navigationMode === "sequential"
      ? getSequentialNavigationLockMessage(selectedLesson)
      : getRestrictedNavigationLockMessage(selectedLesson);
    const canContinue = !completionLockMessage;
    if (canNavigateToLesson(
      lessonIndex,
      targetIndex,
      canContinue,
      visitedLessonIds.has(lessonId),
      navigationMode,
    )) return null;
    if (completionLockMessage) return completionLockMessage;
    return navigationMode === "sequential"
      ? "Complete lessons in order. Continue with the next lesson."
      : "Complete required activities before opening the next lesson.";
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
      : "Complete the current lesson before opening the next one.";
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
      return "Complete each required activity in this lesson before continuing.";
    return null;
  }

  function startLearning() {
    setMode("learn");
    if (!selectedLesson && lessons[0]) selectLesson(lessons[0].id);
  }

  function editCurrentContent() {
    const target = mode === "learn"
      ? previewEditTarget(selectedLessonId, selectedLessonId ? lessonBodyScrollRefs.current.get(selectedLessonId) : null)
      : undefined;
    onEdit?.(target);
  }

  const lessonReaderProps = {
    initialData,
    active: mode === "learn",
    lessons,
    selectedLessonId,
    device: isMobileViewport ? "mobile" as const : device,
    orientation,
    authorName,
    initials,
    quizScores,
    passedQuizIds,
    revealedDividerIds,
    completedDividerIds,
    unlockingDividerIds,
    interactedContentIds,
    navigationMode,
    lessonBodyScrollRefs,
    markContentAboveComplete,
    selectLesson,
    getLessonNavigationLockMessage,
    setQuizScores,
    setPassedQuizIds,
    setLessonScrollProgress,
    setVisitedLessonIds,
    setRevealedDividerIds,
    setPendingContinueScroll,
    setInteractedContentIds,
    setUnlockingDividerIds,
  };

  return (
    <main style={themeStyle} className="flex h-dvh min-h-0 w-full min-w-0 flex-col overflow-hidden bg-slate-100 text-slate-900">
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

      <PreviewViewport device={device} orientation={orientation} fontFamily={courseThemeFontFamilies[courseTheme.fontFamily]} onCompactChange={setIsMobileViewport}>
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
            <div aria-hidden={mode !== "learn"} className={mode === "learn" ? "relative flex h-full min-h-0 min-w-0" : "hidden"}>
              {!useMobileMenu && <LessonMenu {...lessonMenuProps} />}
              {useMobileMenu && mobileMenuOpen && (
                <div className="absolute inset-x-0 bottom-0 top-12 z-40 flex">
                  <button
                    type="button"
                    aria-label="Close course menu"
                    onClick={() => setMobileMenuOpen(false)}
                    className="absolute inset-0 bg-slate-950/40"
                  />
                  <LessonMenu {...lessonMenuProps} mobile />
                </div>
              )}
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <div className="relative z-50 flex min-h-12 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
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
                  ) : (
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
