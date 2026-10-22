"use client";

import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { ContentBlock } from "@/lib/schemas/block";
import { Button } from "@/components/ui/button";
import { getPendingInteractiveProgressIds } from "@/lib/export/progress";
import { blockSurfaceStyle, blockWidthClass } from "../preview-utils";
import type { PreviewDevice, PreviewOrientation } from "../preview-types";
import { PreviewBlock } from "./(lesson_blocks_preview_components)/preview-block";
import { ContinueLockIndicator } from "./(lesson_blocks_preview_components)/continue-lock-indicator";

function findScrollContainer(element: HTMLElement) {
  let parent = element.parentElement;
  while (parent) {
    const styles = window.getComputedStyle(parent);
    const overflow = `${styles.overflow}${styles.overflowY}`;
    if (/(auto|scroll|overlay)/.test(overflow)) return parent;
    parent = parent.parentElement;
  }
  return null;
}

function LessonBlockEntrance({
  blockId,
  animate,
  blockDelay,
  children,
}: {
  blockId: string;
  animate: boolean;
  blockDelay: number;
  children: (entered: boolean) => ReactNode;
}) {
  const blockRef = useRef<HTMLDivElement>(null);
  const setBlockRef = useCallback((node: HTMLDivElement | null) => {
    blockRef.current = node;
  }, []);
  const [inView, setInView] = useState(false);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!animate) return;

    const block = blockRef.current;
    if (!block) return;

    if (reducedMotion === true || typeof IntersectionObserver === "undefined") {
      const frame = window.requestAnimationFrame(() => setInView(true));
      return () => window.cancelAnimationFrame(frame);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setInView(true);
        observer.unobserve(block);
      },
      {
        root: findScrollContainer(block),
        threshold: 0.01,
      },
    );
    observer.observe(block);
    return () => observer.disconnect();
  }, [animate, reducedMotion]);

  const entered = animate && (inView || reducedMotion === true);
  const shouldAnimate = animate && reducedMotion !== true;
  return (
    <motion.div
      ref={setBlockRef}
      data-lesson-block-id={blockId}
      data-lesson-block-in-view={entered}
      initial={shouldAnimate ? { opacity: 0, y: 14 } : false}
      animate={shouldAnimate ? (entered ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }) : { opacity: 1, y: 0 }}
      transition={{
        duration: shouldAnimate ? 0.95 : 0,
        delay: shouldAnimate ? blockDelay / 1000 : 0,
        ease: [0.22, 1, 0.36, 1],
      }}
      style={entered ? { "--lesson-block-delay": `${blockDelay}ms` } as CSSProperties : undefined}
    >
      {children(entered)}
    </motion.div>
  );
}

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
            <LessonBlockEntrance
              key={`${block.id}-${animate ? "active" : "inactive"}`}
              blockId={block.id}
              animate={animate}
              blockDelay={blockDelay}
            >
              {() => (
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
              )}
            </LessonBlockEntrance>
          );
        }
        return (
          <LessonBlockEntrance
            key={`${block.id}-${animate ? "active" : "inactive"}`}
            blockId={block.id}
            animate={animate}
            blockDelay={blockDelay}
          >
            {(entered) => (
              <PreviewBlock
                block={block}
                device={device}
                orientation={orientation}
                animateListItems={entered}
                interactedContentIds={interactedContentIds}
                onInteractiveProgress={onInteractiveProgress}
                lessons={lessons}
                visitedLessonIds={visitedLessonIds}
                passedQuizIds={passedQuizIds}
                getLessonNavigationLockMessage={getLessonNavigationLockMessage}
                onOpenLesson={onOpenLesson}
              />
            )}
          </LessonBlockEntrance>
        );
      })}
    </div>
  );
}
