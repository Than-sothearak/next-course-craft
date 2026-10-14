export type LearnerProgressSnapshot = {
  visitedLessonIds: string[];
  lessonScrollProgress: Record<string, number>;
  revealedDividerIds: string[];
  completedDividerIds: string[];
  selectedLessonId: string | null;
};

export type LearnerProgressAdapter = {
  load(courseId: string): LearnerProgressSnapshot | null;
  save(
    courseId: string,
    snapshot: LearnerProgressSnapshot,
    complete: boolean,
  ): void;
};

export function getPlayerProgress(visitedLessonIds: ReadonlySet<string>, lessonIds: readonly string[]) {
  const currentLessons = new Set(lessonIds);
  if (!currentLessons.size) return 0;
  const completed = [...visitedLessonIds].filter((id) => currentLessons.has(id)).length;
  return Math.round(completed / currentLessons.size * 100);
}

export function hasReachedContentEnd({ scrollHeight, clientHeight, scrollTop }: { scrollHeight: number; clientHeight: number; scrollTop: number }) {
  return scrollHeight <= clientHeight + 1 || scrollTop + clientHeight >= scrollHeight - 2;
}

export function subscribeToScroll(target: EventTarget, onScroll: () => void) {
  const listener = () => onScroll();
  target.addEventListener("scroll", listener, { passive: true });
  return () => target.removeEventListener("scroll", listener);
}

export function canCompleteLesson(metrics: { scrollHeight: number; clientHeight: number; scrollTop: number; hasPendingContinue: boolean }) {
  return !metrics.hasPendingContinue && hasReachedContentEnd(metrics);
}

export function getLessonReadingProgress(metrics: {
  scrollHeight: number;
  clientHeight: number;
  scrollTop: number;
  revealedContinueCount: number;
  totalContinueCount: number;
}) {
  const totalContinueCount = Math.max(0, metrics.totalContinueCount);
  const revealedContinueCount = Math.min(
    totalContinueCount,
    Math.max(0, metrics.revealedContinueCount),
  );
  const reachedEnd = hasReachedContentEnd(metrics);
  if (revealedContinueCount === totalContinueCount && reachedEnd) return 100;

  const maxScroll = Math.max(0, metrics.scrollHeight - metrics.clientHeight);
  const segmentProgress = maxScroll === 0
    ? reachedEnd ? 1 : 0
    : Math.min(1, Math.max(0, metrics.scrollTop / maxScroll));
  const progress = ((revealedContinueCount + segmentProgress) / (totalContinueCount + 1)) * 100;
  return Math.min(99, Math.floor(progress));
}
