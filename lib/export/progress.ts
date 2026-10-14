import type { ContentBlock } from "@/lib/schemas/block";
import type { CourseNavigationMode } from "@/lib/editor/navigation";

export type LearnerProgressSnapshot = {
  visitedLessonIds: string[];
  lessonScrollProgress: Record<string, number>;
  revealedDividerIds: string[];
  completedDividerIds: string[];
  interactedFlipCardIds?: string[];
  interactedContentIds?: string[];
  selectedLessonId: string | null;
  quizScores?: Record<string, number>;
  passedQuizIds?: string[];
};

export function getFlipCardProgressId(blockId: string, cardId: string) {
  return `${blockId}:${cardId}`;
}

export function getInteractiveItemProgressId(
  blockId: string,
  kind: string,
  itemId: string,
) {
  return `${blockId}:${kind}:${itemId}`;
}

export function getInteractiveBlockProgressIds(block: ContentBlock): string[] {
  switch (block.type) {
    case "flipCard":
      return block.data.cards.map((card) =>
        getFlipCardProgressId(block.id, card.id),
      );
    case "accordion":
      return block.data.items.map((item) =>
        getInteractiveItemProgressId(block.id, "section", item.id),
      );
    case "labeledGraphic":
      return block.data.markers.map((marker) =>
        getInteractiveItemProgressId(block.id, "marker", marker.id),
      );
    case "processSteps":
      return block.data.steps.map((step) =>
        getInteractiveItemProgressId(block.id, "step", step.id),
      );
    case "knowledgeCheck":
      return [`${block.id}:answer`];
    case "survey":
      return [`${block.id}:submitted`];
    case "video":
      return [`${block.id}:watched`];
    default:
      return [];
  }
}

export function getInitiallyViewedInteractionIds(
  blocks: readonly ContentBlock[],
) {
  return blocks.flatMap((block) => {
    if (block.type === "accordion") {
      const firstItem = block.data.items[0];
      return firstItem
        ? [getInteractiveItemProgressId(block.id, "section", firstItem.id)]
        : [];
    }
    if (block.type === "processSteps") {
      const firstStep = block.data.steps[0];
      return firstStep
        ? [getInteractiveItemProgressId(block.id, "step", firstStep.id)]
        : [];
    }
    return [];
  });
}

export function getPendingInteractiveProgressIds(
  blocks: readonly ContentBlock[],
  interactedContentIds: ReadonlySet<string>,
  endIndex = blocks.length,
) {
  return blocks
    .slice(0, endIndex)
    .flatMap((block) => getInteractiveBlockProgressIds(block))
    .filter((id) => !interactedContentIds.has(id));
}

export function getPendingRequiredContinueDividerIds(
  blocks: readonly ContentBlock[],
  revealedDividerIds: ReadonlySet<string>,
  completedDividerIds: ReadonlySet<string>,
  interactedContentIds: ReadonlySet<string>,
) {
  return blocks.flatMap((block, index) => {
    if (
      block.type !== "divider" ||
      block.data.style !== "continue" ||
      block.data.completionType !== "completeAbove"
    ) return [];
    const hasPendingInteractiveContent = getPendingInteractiveProgressIds(
      blocks,
      interactedContentIds,
      index,
    ).length > 0;
    const hasCompletedAndRevealed =
      completedDividerIds.has(block.id) && revealedDividerIds.has(block.id);
    return hasPendingInteractiveContent || !hasCompletedAndRevealed
      ? [block.id]
      : [];
  });
}

export function canNavigateToLesson(
  currentIndex: number,
  targetIndex: number,
  canContinueFromCurrentLesson: boolean,
  targetLessonIsVisited = false,
  navigationMode: CourseNavigationMode = "sequential",
) {
  if (targetIndex < 0) return false;
  if (navigationMode === "free") return true;
  if (targetIndex <= currentIndex) return true;
  if (!canContinueFromCurrentLesson) return false;
  return targetIndex === currentIndex + 1 || targetLessonIsVisited;
}

export function getPendingFlipCardIds(
  blocks: readonly ContentBlock[],
  interactedCardIds: ReadonlySet<string>,
  endIndex = blocks.length,
) {
  return blocks
    .slice(0, endIndex)
    .flatMap((block) => block.type === "flipCard"
      ? block.data.cards.map((card) => getFlipCardProgressId(block.id, card.id))
      : [])
    .filter((id) => !interactedCardIds.has(id));
}

export type LearnerProgressAdapter = {
  load(courseId: string): LearnerProgressSnapshot | null;
  save(
    courseId: string,
    snapshot: LearnerProgressSnapshot,
    complete: boolean,
  ): void;
};

export function getCourseProgress(visitedLessonIds: ReadonlySet<string>, lessonIds: readonly string[]) {
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

