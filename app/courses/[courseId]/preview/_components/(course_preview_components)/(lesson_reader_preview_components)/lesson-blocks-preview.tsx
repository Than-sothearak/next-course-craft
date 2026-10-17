"use client";

import type { CSSProperties } from "react";
import type { ContentBlock } from "@/lib/schemas/block";
import { Button } from "@/components/ui/button";
import { getPendingInteractiveProgressIds } from "@/lib/export/progress";
import { blockSurfaceStyle, blockWidthClass } from "../preview-utils";
import type { PreviewDevice, PreviewOrientation } from "../preview-types";
import { PreviewBlock } from "./(lesson_blocks_preview_components)/preview-block";
import { ContinueLockIndicator } from "./(lesson_blocks_preview_components)/continue-lock-indicator";
export function LessonBlocksPreview({
  blocks,
  device,
  orientation,
  animate,
  revealedDividerIds,
  completedDividerIds,
  unlockingDividerIds,
  interactedContentIds,
  onReveal,
  onUnlockAnimationEnd,
  onInteractiveProgress,
  lessons,
  visitedLessonIds,
  passedQuizIds,
  getLessonNavigationLockMessage,
  onOpenLesson,
}: {
  blocks: ContentBlock[];
  device: PreviewDevice;
  orientation: PreviewOrientation;
  animate: boolean;
  revealedDividerIds: Set<string>;
  completedDividerIds: Set<string>;
  unlockingDividerIds: Set<string>;
  interactedContentIds: Set<string>;
  onReveal: (dividerId: string, nextBlockId?: string) => void;
  onUnlockAnimationEnd: (dividerId: string) => void;
  onInteractiveProgress: (progressId: string) => void;
  lessons: { id: string; title: string; sectionId: string; order: number; lessonType?: "content" | "quiz" }[];
  visitedLessonIds: ReadonlySet<string>;
  passedQuizIds: ReadonlySet<string>;
  getLessonNavigationLockMessage: (lessonId: string) => string | null;
  onOpenLesson: (lessonId: string) => void;
}) {
  const firstHiddenDividerIndex = blocks.findIndex(
    (block) =>
      block.type === "divider" &&
      block.data.style === "continue" &&
      (!revealedDividerIds.has(block.id) ||
        (block.data.completionType === "completeAbove" &&
          !completedDividerIds.has(block.id))),
  );
  const visibleBlocks =
    firstHiddenDividerIndex < 0
      ? blocks
      : blocks.slice(0, firstHiddenDividerIndex + 1);
  const mostRecentRevealedDividerIndex = visibleBlocks.reduce(
    (lastIndex, block, index) =>
      block.type === "divider" &&
      block.data.style === "continue" &&
      revealedDividerIds.has(block.id)
        ? index
        : lastIndex,
    -1,
  );

  return (
    <div className="mt-10 min-w-0 shrink-0">
      {visibleBlocks.map((block, index) => {
        const blockDelay = Math.min(
          2100,
          Math.max(0, index - mostRecentRevealedDividerIndex - 1) * 240,
        );
        const animationStyle = animate
          ? ({
              animationDelay: `${blockDelay}ms`,
              "--lesson-block-delay": `${blockDelay}ms`,
            } as CSSProperties)
          : undefined;
        if (block.type === "divider" && block.data.style === "continue") {
          const requiresCompletion = block.data.completionType === "completeAbove";
          if (
            revealedDividerIds.has(block.id) &&
            (!requiresCompletion || completedDividerIds.has(block.id))
          ) return null;
          const widthClass = blockWidthClass(block);
          const hasPendingInteractiveContent = requiresCompletion &&
            getPendingInteractiveProgressIds(
              blocks,
              interactedContentIds,
              index,
            ).length > 0;
          const isLocked = requiresCompletion &&
            (hasPendingInteractiveContent || !completedDividerIds.has(block.id));
          const lockHint = hasPendingInteractiveContent
            ? "Complete the interactive activities above to unlock Continue."
            : "Read to the end of the content above to unlock Continue.";
          const isUnlocking = unlockingDividerIds.has(block.id);
          return (
            <div
              key={block.id}
              data-lesson-block-id={block.id}
              className={animate ? "lesson-block-enter" : undefined}
              style={animationStyle}
            >
              <div className="w-full" style={blockSurfaceStyle(block)}>
                <div className={`mx-auto w-full ${widthClass} px-4`}>
                  <div className="flex flex-col items-center gap-2 text-center">
                    <Button
                      type="button"
                      disabled={isLocked}
                      onClick={() => onReveal(block.id, blocks[index + 1]?.id)}
                      className="min-w-36 rounded-full px-6"
                      style={{ backgroundColor: "var(--course-primary)" }}
                      aria-label={isLocked ? `${block.data.label.trim() || "Continue"} (locked). ${lockHint}` : block.data.label.trim() || "Continue"}
                      title={isLocked ? lockHint : undefined}
                    >
                      {isLocked || isUnlocking ? (
                        <ContinueLockIndicator
                          unlocking={isUnlocking}
                          onAnimationEnd={() => onUnlockAnimationEnd(block.id)}
                        />
                      ) : null}
                      {block.data.label.trim() || "Continue"}
                    </Button>
                    {isLocked ? (
                      <p
                        role="status"
                        className="max-w-sm text-xs leading-relaxed text-slate-500"
                      >
                        {hasPendingInteractiveContent
                          ? "Complete the interactive activities above to unlock Continue."
                          : "Read to the end of the content above to unlock Continue."}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          );
        }
        return (
          <div
            key={block.id}
            data-lesson-block-id={block.id}
            className={animate ? "lesson-block-enter" : undefined}
            style={animationStyle}
          >
            <PreviewBlock
              block={block}
              device={device}
              orientation={orientation}
              animateListItems={animate}
              interactedContentIds={interactedContentIds}
              onInteractiveProgress={onInteractiveProgress}
              lessons={lessons}
              visitedLessonIds={visitedLessonIds}
              passedQuizIds={passedQuizIds}
              getLessonNavigationLockMessage={getLessonNavigationLockMessage}
              onOpenLesson={onOpenLesson}
            />
          </div>
        );
      })}
    </div>
  );
}
