import type { ContentBlock } from "@/lib/schemas/block";
import type { CourseNavigationMode } from "@/lib/editor/navigation";
import { isInteractionTarget } from "@/lib/editor/interaction-button";
import { mediaProgressPercent, mediaProgressSource, type MediaProgress } from "./media-playback";

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
  mediaProgress?: MediaProgress;
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

export function getInteractiveBlockProgressIds(block: ContentBlock, lessonBlocks?: readonly ContentBlock[]): string[] {
  switch (block.type) {
    case "hangingRopeCards":
      return block.data.cards.map((card) => getInteractiveItemProgressId(block.id, "rope", card.id));
    case "peelToReveal":
      return [`${block.id}:revealed`];
    case "interactionButton":
      return (block.data.action === "popup" ? block.data.popup.blocks.length > 0 : Boolean(block.data.targetBlockId) && (!lessonBlocks || lessonBlocks.some((item) => item.id === block.data.targetBlockId && isInteractionTarget(item, block.id)))) ? [`${block.id}:opened`] : [];
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
    case "balloonArcher":
      return block.data.balloons.map((balloon) => getInteractiveItemProgressId(block.id, "balloon", balloon.id));
    case "processSteps":
      return block.data.steps.map((step) =>
        getInteractiveItemProgressId(block.id, "step", step.id),
      );
    case "knowledgeCheck":
      return [`${block.id}:answer`];
    case "survey":
      return [`${block.id}:submitted`];
    case "audio":
    case "audioInstruction":
      return block.data.src ? [`${block.id}:listened`] : [];
    case "video":
      return block.data.mimeType || /\.(mp4|webm|ogg)(?:$|[?#])/i.test(block.data.src)
        ? [`${block.id}:watched`]
        : [];
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
    .filter((block) => block.requiredForProgress !== false)
    .flatMap((block) => getInteractiveBlockProgressIds(block, blocks))
    .filter((id) => !interactedContentIds.has(id));
}

function getCompletedActivityCount(
  activityIds: readonly string[],
  blocks: readonly ContentBlock[],
  interactedContentIds: ReadonlySet<string>,
  mediaProgress: MediaProgress,
) {
  return activityIds.reduce((total, id) => {
    if (interactedContentIds.has(id)) return total + 1;
    const block = blocks.find((item) => (item.type === "audio" && `${item.id}:listened` === id) || (item.type === "video" && `${item.id}:watched` === id));
    const partial = mediaProgress[id];
    return total + (block && (block.type === "audio" || block.type === "video") && partial?.source === mediaProgressSource(block.data.src) ? mediaProgressPercent(partial) / 100 : 0);
  }, 0);
}

export function getRestrictedLessonProgress(
  readingProgress: number,
  blocks: readonly ContentBlock[],
  interactedContentIds: ReadonlySet<string>,
  mediaProgress: MediaProgress = {},
) {
  const activityIds = blocks.filter((block) => block.requiredForProgress !== false).flatMap((block) =>
    getInteractiveBlockProgressIds(block, blocks),
  );
  if (activityIds.length === 0) return readingProgress;

  const completedActivityCount = getCompletedActivityCount(activityIds, blocks, interactedContentIds, mediaProgress);
  const activityProgress = (completedActivityCount / activityIds.length) * 100;

  // Standard lessons combine reading with completed activities and media checkpoints.
  return Math.floor((readingProgress + activityProgress) / 2 + 1e-9);
}

/** Presentation slides earn progress through actions, with no reading credit. */
export function getPresentationLessonProgress(
  blocks: readonly ContentBlock[],
  interactedContentIds: ReadonlySet<string>,
  mediaProgress: MediaProgress = {},
  revealedDividerIds: ReadonlySet<string> = new Set(),
): number | null {
  const activityIds = blocks.filter((block) => block.requiredForProgress !== false).flatMap((block) => getInteractiveBlockProgressIds(block, blocks));
  const continueIds = blocks.filter((block) => block.requiredForProgress !== false && block.type === "divider" && block.data.style === "continue").map((block) => block.id);
  if (!activityIds.length && !continueIds.length) return null;
  const completedActivityCount = getCompletedActivityCount(activityIds, blocks, interactedContentIds, mediaProgress);
  const completedContinueCount = continueIds.filter((id) => revealedDividerIds.has(id)).length;
  return Math.floor((completedActivityCount + completedContinueCount) / (activityIds.length + continueIds.length) * 100 + 1e-9);
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
      block.requiredForProgress === false ||
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
    .filter((block) => block.requiredForProgress !== false)
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

export function getCourseProgress(visitedLessonIds: ReadonlySet<string>, lessonIds: readonly string[], partialProgress: Record<string, number> = {}) {
  const currentLessons = new Set(lessonIds);
  if (!currentLessons.size) return 0;
  const total = [...currentLessons].reduce((sum, id) => {
    const partial = Number.isFinite(partialProgress[id]) ? partialProgress[id] : 0;
    return sum + (visitedLessonIds.has(id) ? 100 : Math.min(99, Math.max(0, partial)));
  }, 0);
  if (Object.keys(partialProgress).length === 0) return Math.round(total / currentLessons.size);
  const fullyComplete = [...currentLessons].every((id) => visitedLessonIds.has(id));
  return Math.min(fullyComplete ? 100 : 99, Math.round(total / currentLessons.size));
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
