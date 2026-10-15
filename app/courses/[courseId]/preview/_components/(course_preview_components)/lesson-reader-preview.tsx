"use client";

import type { Dispatch, SetStateAction } from "react";
import { ArrowLeft, ArrowRight, BookOpen, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  courseNavigationModeOptions,
  type CourseNavigationMode,
} from "@/lib/editor/navigation";
import type { PreviewData, PreviewDevice, PreviewLesson, PreviewOrientation } from "./preview-types";
import { StatementTextPreview } from "../../../edit/_components/statement-text-preview";
import { QuizAssessmentPreview } from "./(lesson_reader_preview_components)/quiz-assessment-preview";
import { LessonBlocksPreview } from "./(lesson_reader_preview_components)/lesson-blocks-preview";
import { getPendingRequiredContinueDividerIds } from "@/lib/export/progress";
import { useLessonTransition } from "./(lesson_reader_preview_components)/use-lesson-transition";

type PendingContinueScroll = { lessonId: string; blockId: string } | null;
type RecordRef<T> = { current: Map<string, T> };

type LessonReaderPreviewProps = {
  initialData: Pick<PreviewData, "authorVisible">;
  active: boolean;
  lessons: PreviewLesson[];
  selectedLessonId: string | null;
  device: PreviewDevice;
  orientation: PreviewOrientation;
  authorName: string;
  initials: string;
  quizScores: Record<string, number>;
  passedQuizIds: ReadonlySet<string>;
  revealedDividerIds: Set<string>;
  completedDividerIds: Set<string>;
  unlockingDividerIds: Set<string>;
  interactedContentIds: Set<string>;
  navigationMode: CourseNavigationMode;
  lessonBodyScrollRefs: RecordRef<HTMLDivElement>;
  markContentAboveComplete: (lesson: PreviewLesson, element: HTMLDivElement) => void;
  selectLesson: (lessonId: string) => void;
  getLessonNavigationLockMessage: (lessonId: string) => string | null;
  setQuizScores: Dispatch<SetStateAction<Record<string, number>>>;
  setPassedQuizIds: Dispatch<SetStateAction<Set<string>>>;
  setLessonScrollProgress: Dispatch<SetStateAction<Record<string, number>>>;
  setVisitedLessonIds: Dispatch<SetStateAction<Set<string>>>;
  setRevealedDividerIds: Dispatch<SetStateAction<Set<string>>>;
  setPendingContinueScroll: Dispatch<SetStateAction<PendingContinueScroll>>;
  setInteractedContentIds: Dispatch<SetStateAction<Set<string>>>;
  setUnlockingDividerIds: Dispatch<SetStateAction<Set<string>>>;
};

export function LessonReaderPreview({
  initialData,
  active,
  lessons,
  selectedLessonId,
  device,
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
}: LessonReaderPreviewProps) {
  const { readerRef, navigateSection } = useLessonTransition({ selectedLessonId, active, device, orientation, lessonBodyScrollRefs, selectLesson, getLessonNavigationLockMessage });
  return (
    <div
      ref={readerRef}
      data-preview-reader
      className="relative min-h-0 min-w-0 flex-1 overflow-clip overscroll-none"
    >
      {lessons.length ? (
        lessons.map((lesson, index) => (
          <article
            key={lesson.id}
            id={`preview-content-${lesson.id}`}
            aria-hidden={lesson.id !== selectedLessonId}
            inert={lesson.id !== selectedLessonId}
            className={lesson.id === selectedLessonId ? "mx-auto flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden" : "hidden"}
          >
            <div
              ref={(node) => {
                if (node)
                  lessonBodyScrollRefs.current.set(lesson.id, node);
                else lessonBodyScrollRefs.current.delete(lesson.id);
              }}
              onScroll={(event) =>
                active && lesson.id === selectedLessonId && markContentAboveComplete(
                  lesson,
                  event.currentTarget,
                )
              }
              className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain [scrollbar-gutter:stable]"
            >
              <nav
                aria-label={`Previous section from content ${index + 1}`}
                className="mb-[60px] w-full shrink-0"
              >
                <Button
                  type="button"
                  variant="ghost"
                  disabled={index <= 0}
                  onClick={() =>
                    lessons[index - 1] &&
                    navigateSection(lessons[index - 1].id, "previous")
                  }
                  className="relative h-auto min-h-20 w-full justify-center rounded-none border-0 bg-slate-100 px-14 py-4 text-center text-slate-700 hover:bg-slate-200"
                >
                  <span className="flex min-w-0 flex-col items-center whitespace-normal leading-tight">
                    <span className="text-[11px] font-medium tracking-wide text-slate-500">
                      {Math.max(index, 1)}/{lessons.length}
                    </span>
                    <span className="mt-1 inline-flex max-w-full items-center justify-center gap-2 text-base font-semibold sm:text-lg">
                      <ArrowLeft
                        size={18}
                        aria-hidden="true"
                        className="shrink-0"
                      />
                      {lessons[index - 1]?.title || "Start of course"}
                    </span>
                  </span>
                </Button>
              </nav>
              <div className="mx-auto w-full max-w-[720px] shrink-0 px-4 pb-8">
                <StatementTextPreview
                  tag="h3"
                  text={lesson.title}
                  html={lesson.titleHtml}
                  className={`font-bold tracking-tight  text-slate-900 ${device === "mobile" ? "text-3xl" : "text-4xl"} [&_h1]:my-0 [&_h1]:text-inherit [&_h1]:font-bold [&_h1]:tracking-tight [&_h2]:my-0 [&_h2]:text-inherit [&_h2]:font-bold [&_h3]:my-0 [&_h3]:text-inherit [&_h3]:font-bold [&_p]:my-0 [&_p]:text-inherit [&_p]:font-bold`}
                />
                {initialData.authorVisible && (
                  <div className="mt-4 flex items-center gap-2.5 text-xs font-medium text-slate-500">
                    <span className="grid size-8 place-items-center rounded-full text-[10px] font-semibold text-white" style={{ backgroundColor: "var(--course-accent)" }}>
                      {initials}
                    </span>
                    <span>{authorName}</span>
                    <span className="ml-2 border-l border-slate-200 pl-3 uppercase tracking-wide">
                      Content {index + 1} / {lessons.length}
                    </span>
                  </div>
                )}
              </div>
              {lesson.lessonType === "quiz" ? (
                lesson.quizQuestions.length ? (
                  <QuizAssessmentPreview
                    questions={lesson.quizQuestions}
                    passingScore={lesson.passingScore ?? 70}
                    savedScore={quizScores[lesson.id]}
                    wasPassed={passedQuizIds.has(lesson.id)}
                    onResult={(result) => {
                      setQuizScores((previous) => ({
                        ...previous,
                        [lesson.id]: Math.max(previous[lesson.id] ?? 0, result.score),
                      }));
                      if (result.passed) {
                        setPassedQuizIds((previous) => new Set(previous).add(lesson.id));
                        setLessonScrollProgress((previous) => ({ ...previous, [lesson.id]: 100 }));
                        setVisitedLessonIds((previous) => new Set(previous).add(lesson.id));
                      }
                    }}
                  />
                ) : (
                  <div className="mt-10 rounded-xl border border-dashed border-slate-300 px-5 py-8 text-center text-sm text-slate-500">
                    This quiz has no questions yet.
                  </div>
                )
              ) : lesson.blocks.length ? (
                <LessonBlocksPreview
                  blocks={lesson.blocks}
                  device={device}
                  orientation={orientation}
                  animate={lesson.id === selectedLessonId}
                  revealedDividerIds={revealedDividerIds}
                  completedDividerIds={completedDividerIds}
                  unlockingDividerIds={unlockingDividerIds}
                  interactedContentIds={interactedContentIds}
                  onReveal={(dividerId, nextBlockId) => {
                    setRevealedDividerIds((previous) =>
                      new Set(previous).add(dividerId),
                    );
                    if (nextBlockId)
                      setPendingContinueScroll({
                        lessonId: lesson.id,
                        blockId: nextBlockId,
                      });
                  }}
                  onInteractiveProgress={(progressId) => {
                    setInteractedContentIds((previous) => {
                      if (previous.has(progressId)) return previous;
                      return new Set(previous).add(progressId);
                    });
                  }}
                  onUnlockAnimationEnd={(dividerId) => {
                    setUnlockingDividerIds((previous) => {
                      if (!previous.has(dividerId)) return previous;
                      const next = new Set(previous);
                      next.delete(dividerId);
                      return next;
                    });
                  }}
                />
              ) : (
                <div className="mt-10 rounded-xl border border-dashed border-slate-300 px-5 py-8 text-center text-sm text-slate-500">
                  This content has no lesson material yet.
                </div>
              )}
              <nav
                aria-label={`Next section from content ${index + 1}`}
                className="mt-auto w-full shrink-0 pt-[60px]"
              >
                {(() => {
                  const nextLesson = lessons[index + 1];
                  if (!nextLesson) return null;
                  const hasPendingContinue = lesson.lessonType !== "quiz" && lesson.blocks.some((block) =>
                    block.type === "divider" && block.data.style === "continue" &&
                    (!revealedDividerIds.has(block.id) ||
                      (block.data.completionType === "completeAbove" && !completedDividerIds.has(block.id))),
                  );
                  if (hasPendingContinue) return null;
                  const navigationLockMessage =
                    getLessonNavigationLockMessage(nextLesson.id);
                  if (navigationLockMessage) {
                    const hasPendingContinueGate =
                      lesson.lessonType !== "quiz" &&
                      getPendingRequiredContinueDividerIds(
                        lesson.blocks,
                        revealedDividerIds,
                        completedDividerIds,
                        interactedContentIds,
                      ).length > 0;
                    const navigationNote =
                      courseNavigationModeOptions.find(
                        (option) => option.value === navigationMode,
                      )?.description;
                    if (
                      lesson.id !== selectedLessonId ||
                      hasPendingContinueGate ||
                      !navigationNote
                    ) return null;
                    return (
                      <p
                        role="note"
                        className="flex min-h-20 items-center justify-center gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4 text-center text-sm text-slate-600"
                      >
                        <LockKeyhole
                          size={15}
                          aria-hidden="true"
                          className="shrink-0 text-slate-400"
                        />
                        <span>{navigationNote}</span>
                      </p>
                    );
                  }
                  return (
                    <Button
                      type="button"
                      variant="default"
                      onClick={() =>
                        navigateSection(nextLesson.id, "next")
                      }
                      className="relative h-auto min-h-20 w-full justify-center rounded-none border-0 px-14 py-4 text-center text-white"
                      style={{ backgroundColor: "var(--course-primary)" }}
                    >
                      <span className="flex min-w-0 flex-col items-center whitespace-normal leading-tight">
                        <span className="text-[11px] font-medium tracking-wide text-white/75">
                          {index + 2}/{lessons.length}
                        </span>
                        <span className="mt-1 inline-flex max-w-full items-center justify-center gap-2 text-base font-semibold sm:text-lg">
                          {nextLesson.title}
                          <ArrowRight
                            size={18}
                            aria-hidden="true"
                            className="shrink-0"
                          />
                        </span>
                      </span>
                    </Button>
                  );
                })()}
              </nav>
            </div>
          </article>
        ))
      ) : (
        <div className="grid min-h-full place-items-center px-6 py-12 text-center">
          <div className="max-w-sm">
            <BookOpen
              size={34}
              className="mx-auto"
              style={{ color: "var(--course-primary)" }}
            />
            <h2 className="mt-4 text-xl font-semibold">
              Your course is ready to explore
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Choose a content item from the course menu to preview
              it.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
