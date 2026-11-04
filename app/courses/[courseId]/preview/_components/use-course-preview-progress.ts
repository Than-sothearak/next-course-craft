"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { mediaProgressSource, validMediaProgress } from "@/lib/export/media-playback";
import {
  canCompleteLesson,
  getCourseProgress,
  getFlipCardProgressId,
  getInitiallyViewedInteractionIds,
  getPendingInteractiveProgressIds,
  getPresentationLessonProgress,
  getRestrictedLessonProgress,
  getLessonReadingProgress,
  hasReachedContentEnd,
  type LearnerProgressAdapter,
  type LearnerProgressSnapshot,
} from "@/lib/export/progress";
import { getSlideMediaBlockIds, sumKnownMediaDurations } from "@/lib/editor/slide-media-duration";
import type { CourseNavigationMode } from "@/lib/editor/navigation";
import { useMediaProgress } from "@/components/media-progress-context";
import type { PreviewData, PreviewMode } from "./(course_preview_components)/preview-types";

export function useCoursePreviewProgress({
  courseId,
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
}: {
  courseId: string;
  lessons: PreviewData["lessons"];
  slideCourse: boolean;
  initialLessonId?: string;
  firstSlideId: string | null;
  navigationMode: CourseNavigationMode;
  mode: PreviewMode;
  selectedLessonId: string | null;
  setSelectedLessonId: Dispatch<SetStateAction<string | null>>;
  progressAdapter?: LearnerProgressAdapter;
  persistLocalProgress: boolean;
  mediaProgress: ReturnType<typeof useMediaProgress>["mediaProgress"];
  restoreMediaProgress: ReturnType<typeof useMediaProgress>["restoreMediaProgress"];
}) {
  const lessonBodyScrollRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [visitedLessonIds, setVisitedLessonIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [lessonScrollProgress, setLessonScrollProgress] = useState<
    Record<string, number>
  >({});
  const [slideMediaBlockDurations, setSlideMediaBlockDurations] = useState<
    Record<string, Record<string, number>>
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
  const completedLessonIds = useMemo(
    () =>
      new Set(
        lessons
          .filter((lesson) => {
            if ((lessonScrollProgress[lesson.id] ?? 0) < 100) return false;
            if (lesson.lessonType === "quiz") return passedQuizIds.has(lesson.id);
            return getPendingInteractiveProgressIds(
              lesson.blocks,
              interactedContentIds,
            ).length === 0;
          })
          .map((lesson) => lesson.id),
      ),
    [interactedContentIds, lessonScrollProgress, lessons, passedQuizIds],
  );
  const progress = getCourseProgress(
    completedLessonIds,
    lessons.map((lesson) => lesson.id),
    slideCourse ? lessonScrollProgress : {},
  );
  const completedLessonCount = completedLessonIds.size;
  const slideMediaDurations = useMemo(
    () => {
      const durationsBySlide: Record<string, number> = {};
      for (const lesson of lessons) {
        const mediaBlockIds = getSlideMediaBlockIds(lesson.blocks);
        const blockDurations = slideMediaBlockDurations[lesson.id];
        if (
          !mediaBlockIds.length ||
          mediaBlockIds.some((blockId) => blockDurations?.[blockId] === undefined)
        )
          continue;
        const duration = sumKnownMediaDurations(
          mediaBlockIds.map((blockId) => blockDurations[blockId]),
        );
        if (duration !== null) durationsBySlide[lesson.id] = duration;
      }
      return durationsBySlide;
    },
    [lessons, slideMediaBlockDurations],
  );
  const recordSlideMediaDuration = useCallback(
    (lessonId: string, blockId: string, duration: number | null) => {
      setSlideMediaBlockDurations((previous) => {
        const existingDuration = previous[lessonId]?.[blockId];
        if (duration === null) {
          if (existingDuration === undefined) return previous;
          const nextSlideDurations = { ...previous[lessonId] };
          delete nextSlideDurations[blockId];
          const next = { ...previous };
          if (Object.keys(nextSlideDurations).length)
            next[lessonId] = nextSlideDurations;
          else delete next[lessonId];
          return next;
        }
        if (existingDuration === duration) return previous;
        return {
          ...previous,
          [lessonId]: { ...previous[lessonId], [blockId]: duration },
        };
      });
    },
    [],
  );
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        let snapshot: LearnerProgressSnapshot | null =
          progressAdapter?.load(courseId) ?? null;
        if (!progressAdapter && persistLocalProgress) {
          const stored = window.localStorage.getItem(
            `coursecraft-progress-v2-${courseId}`,
          );
          const parsed = stored
            ? (JSON.parse(stored) as LearnerProgressSnapshot | string[])
            : null;
          snapshot = Array.isArray(parsed)
            ? {
                visitedLessonIds: parsed,
                lessonScrollProgress: {},
                revealedDividerIds: [],
                completedDividerIds: [],
                selectedLessonId: null,
              }
            : parsed;
        }
        const restoredMediaProgress = validMediaProgress(snapshot?.mediaProgress);
        if (slideCourse) restoreMediaProgress(restoredMediaProgress);
        const restoredInteractedContentIds = new Set([
          ...(snapshot?.interactedContentIds ?? []),
          ...(snapshot?.interactedFlipCardIds ?? []),
        ]);
        for (const lesson of lessons) for (const block of lesson.blocks) {
          if (block.type !== "audio" && block.type !== "video") continue;
          const id = `${block.id}:${block.type === "video" ? "watched" : "listened"}`;
          if (restoredMediaProgress[id] && restoredMediaProgress[id].source !== mediaProgressSource(block.data.src)) restoredInteractedContentIds.delete(id);
        }
        const restoredProgressLesson =
          lessons.find((lesson) => lesson.id === initialLessonId) ??
          lessons.find((lesson) => lesson.id === snapshot?.selectedLessonId);
        if (!slideCourse && restoredProgressLesson && restoredProgressLesson.lessonType !== "quiz") {
          getInitiallyViewedInteractionIds(restoredProgressLesson.blocks).forEach(
            (id) => restoredInteractedContentIds.add(id),
          );
        }
        const restoredLessonScrollProgress = {
          ...(snapshot?.lessonScrollProgress ?? {}),
        };
        for (const lesson of lessons) {
          if (
            lesson.lessonType === "quiz"
          ) continue;
          const actionProgress = slideCourse ? getPresentationLessonProgress(lesson.blocks, restoredInteractedContentIds, restoredMediaProgress, new Set(snapshot?.revealedDividerIds ?? [])) : null;
          if (actionProgress !== null) {
            restoredLessonScrollProgress[lesson.id] = actionProgress;
            continue;
          }
          const pendingActivities = getPendingInteractiveProgressIds(
            lesson.blocks,
            restoredInteractedContentIds,
          );
          if (pendingActivities.length) {
            restoredLessonScrollProgress[lesson.id] = Math.min(restoredLessonScrollProgress[lesson.id] ?? 0, getRestrictedLessonProgress(
              100,
              lesson.blocks,
              restoredInteractedContentIds,
            ));
          }
        }
        setVisitedLessonIds((current) =>
          new Set([...(snapshot?.visitedLessonIds ?? []), ...current]),
        );
        setLessonScrollProgress((current) => ({
          ...restoredLessonScrollProgress,
          ...current,
        }));
        setQuizScores((current) => ({ ...snapshot?.quizScores, ...current }));
        const restoredPassedQuizIds =
          snapshot?.passedQuizIds ??
          lessons
            .filter(
              (lesson) =>
                lesson.lessonType === "quiz" &&
                snapshot?.visitedLessonIds?.includes(lesson.id),
            )
            .map((lesson) => lesson.id);
        setPassedQuizIds((current) =>
          new Set([...restoredPassedQuizIds, ...current]),
        );
        setRevealedDividerIds((current) =>
          new Set([...(snapshot?.revealedDividerIds ?? []), ...current]),
        );
        setCompletedDividerIds((current) =>
          new Set([...(snapshot?.completedDividerIds ?? []), ...current]),
        );
        const resumedLesson = lessons.find(
          (lesson) => lesson.id === snapshot?.selectedLessonId,
        );
        const selectedPreviewLesson = lessons.find(
          (lesson) => lesson.id === initialLessonId,
        );
        const progressLesson = selectedPreviewLesson ?? resumedLesson;
        if (
          !slideCourse && progressLesson &&
          progressLesson.id !== restoredProgressLesson?.id &&
          progressLesson.lessonType !== "quiz"
        ) {
          getInitiallyViewedInteractionIds(progressLesson.blocks).forEach((id) =>
            restoredInteractedContentIds.add(id),
          );
        }
        setInteractedContentIds((current) =>
          new Set([...restoredInteractedContentIds, ...current]),
        );
        setSelectedLessonId((current) => {
          const fallbackId =
            slideCourse || initialLessonId ? (lessons[0]?.id ?? null) : null;
          if (selectedPreviewLesson) return selectedPreviewLesson.id;
          if (slideCourse && current === firstSlideId)
            return resumedLesson?.id ?? fallbackId;
          if (lessons.some((lesson) => lesson.id === current)) return current;
          // Old HTML/LMS progress can refer to a slide removed in a newer export.
          return resumedLesson?.id ?? fallbackId;
        });
      } catch {
        setVisitedLessonIds(new Set());
        setLessonScrollProgress({});
        setQuizScores({});
        setPassedQuizIds(new Set());
        setRevealedDividerIds(new Set());
        setCompletedDividerIds(new Set());
        setInteractedContentIds(new Set());
      } finally {
        setProgressLoadedCourseId(courseId);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    courseId,
    firstSlideId,
    initialLessonId,
    lessons,
    persistLocalProgress,
    progressAdapter,
    restoreMediaProgress,
    setSelectedLessonId,
    slideCourse,
  ]);

  useEffect(() => {
    if (progressLoadedCourseId !== courseId) return;
    if (progressAdapter) {
      progressAdapter.save(
        courseId,
        {
          visitedLessonIds: [...visitedLessonIds],
          lessonScrollProgress,
          revealedDividerIds: [...revealedDividerIds],
          completedDividerIds: [...completedDividerIds],
          interactedFlipCardIds: [...interactedContentIds].filter((id) =>
            flipCardProgressIds.has(id),
          ),
          interactedContentIds: [...interactedContentIds],
          ...(Object.keys(mediaProgress).length ? { mediaProgress } : {}),
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
        `coursecraft-progress-v2-${courseId}`,
        JSON.stringify({
          visitedLessonIds: [...visitedLessonIds],
          lessonScrollProgress,
          revealedDividerIds: [...revealedDividerIds],
          completedDividerIds: [...completedDividerIds],
          interactedFlipCardIds: [...interactedContentIds].filter((id) =>
            flipCardProgressIds.has(id),
          ),
          interactedContentIds: [...interactedContentIds],
          ...(Object.keys(mediaProgress).length ? { mediaProgress } : {}),
          selectedLessonId,
          quizScores,
          passedQuizIds: [...passedQuizIds],
        }),
      );
    } catch {
      // Standalone file URLs may not allow local storage.
    }
  }, [
    courseId,
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
    mediaProgress,
    selectedLessonId,
  ]);

  const markContentAboveComplete = useCallback(
    (lesson: (typeof lessons)[number], element: HTMLDivElement) => {
      if (lesson.lessonType === "quiz") {
        if (passedQuizIds.has(lesson.id)) {
          setLessonScrollProgress((previous) =>
            previous[lesson.id] === 100
              ? previous
              : { ...previous, [lesson.id]: 100 },
          );
          setVisitedLessonIds((previous) =>
            previous.has(lesson.id)
              ? previous
              : new Set(previous).add(lesson.id),
          );
        }
        return;
      }
      const divider = lesson.blocks.find(
        (block) =>
          block.type === "divider" &&
          block.data.style === "continue" &&
          block.requiredForProgress !== false &&
          (!revealedDividerIds.has(block.id) ||
            (block.data.completionType === "completeAbove" &&
              !completedDividerIds.has(block.id))),
      );
      const continueDividers = lesson.blocks.filter(
        (block) =>
          block.type === "divider" &&
          block.data.style === "continue" &&
          block.requiredForProgress !== false,
      );
      const revealedContinueCount = continueDividers.filter((block) =>
        revealedDividerIds.has(block.id),
      ).length;
      const actionProgress = slideCourse ? getPresentationLessonProgress(lesson.blocks, interactedContentIds, mediaProgress, revealedDividerIds) : null;
      const reachedEnd = actionProgress !== null || hasReachedContentEnd(element);
      const pendingRequiredActivities = getPendingInteractiveProgressIds(
        lesson.blocks,
        interactedContentIds,
      );
      const hasPendingRequiredActivities =
        navigationMode === "restricted" && pendingRequiredActivities.length > 0;
      const readingProgress = getLessonReadingProgress({
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
        scrollTop: element.scrollTop,
        revealedContinueCount,
        totalContinueCount: continueDividers.length,
      });
      const trackedProgress = actionProgress ?? getRestrictedLessonProgress(
        readingProgress,
        lesson.blocks,
        interactedContentIds,
      );
      setLessonScrollProgress((previous) =>
        (actionProgress === null ? (previous[lesson.id] ?? 0) >= trackedProgress : previous[lesson.id] === trackedProgress)
          ? previous
          : { ...previous, [lesson.id]: trackedProgress },
      );
      if (!reachedEnd) return;
      if (divider?.type === "divider") {
        const dividerIndex = lesson.blocks.findIndex(
          (block) => block.id === divider.id,
        );
        const hasPendingInteractiveContentAboveDivider =
          getPendingInteractiveProgressIds(
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
          setUnlockingDividerIds((previous) =>
            new Set(previous).add(divider.id),
          );
        }
        return;
      }
      if (
        canCompleteLesson({
          scrollHeight: element.scrollHeight,
          clientHeight: element.clientHeight,
          scrollTop: element.scrollTop,
          hasPendingContinue: hasPendingRequiredActivities,
        })
      ) {
        setVisitedLessonIds((previous) =>
          previous.has(lesson.id) ? previous : new Set(previous).add(lesson.id),
        );
      }
    },
    [
      completedDividerIds,
      interactedContentIds,
      mediaProgress,
      slideCourse,
      navigationMode,
      passedQuizIds,
      revealedDividerIds,
    ],
  );

  useEffect(() => {
    if (mode !== "learn") return;
    const lesson = lessons.find((item) => item.id === selectedLessonId);
    const element = lesson
      ? lessonBodyScrollRefs.current.get(lesson.id)
      : undefined;
    if (!lesson || !element) return;
    const update = () => {
      if (element.clientHeight > 0) markContentAboveComplete(lesson, element);
    };
    const frame = window.requestAnimationFrame(update);
    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(update);
    observer?.observe(element);
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [
    mode,
    selectedLessonId,
    revealedDividerIds,
    interactedContentIds,
    lessons,
    markContentAboveComplete,
  ]);

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


  return {
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
  };
}
