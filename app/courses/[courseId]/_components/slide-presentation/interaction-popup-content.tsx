"use client";

import { useState, type ComponentProps } from "react";
import { getInitiallyViewedInteractionIds, getPendingInteractiveProgressIds } from "@/lib/export/progress";
import type { ContentBlock } from "@/lib/schemas/block";
import { LessonBlocksPreview } from "../../preview/_components/(course_preview_components)/(lesson_reader_preview_components)/lesson-blocks-preview";
import { InteractionPopupSurface } from "./interaction-popup-surface";

type Props = Pick<ComponentProps<typeof LessonBlocksPreview>, "blocks" | "device" | "orientation" | "lessons" | "visitedLessonIds" | "passedQuizIds" | "getLessonNavigationLockMessage" | "onOpenLesson"> & {
  popup: Extract<ContentBlock, { type: "interactionButton" }>["data"]["popup"];
  authoring: boolean;
  interactedContentIds?: ReadonlySet<string>;
  onInteractiveProgress?: (id: string) => void;
};

/** Popup activities share normal slide rendering and keep their progress local. */
export function InteractionPopupContent({ popup, blocks, authoring, interactedContentIds, onInteractiveProgress, ...props }: Props) {
  const [localInteractions, setLocalInteractions] = useState(() => new Set(getInitiallyViewedInteractionIds(blocks)));
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  const interactions = new Set([...localInteractions, ...interactedContentIds ?? []]);
  // The entire mini slide fits the popup viewport, so text is already in view.
  const completed = new Set(blocks.filter((block, index) => block.type === "divider" && getPendingInteractiveProgressIds(blocks, interactions, index).length === 0).map((block) => block.id));
  return <InteractionPopupSurface popup={popup}><LessonBlocksPreview {...props} blocks={blocks} slideLayout slideArea={popup} slideBackgroundColor={popup.backgroundColor} slideTextColor={popup.textColor} animate={false} authoring={authoring} revealedDividerIds={revealed} completedDividerIds={completed} unlockingDividerIds={new Set()} interactedContentIds={interactions} onReveal={(id) => setRevealed((current) => new Set([...current, id]))} onUnlockAnimationEnd={() => {}} onInteractiveProgress={(id) => { setLocalInteractions((current) => current.has(id) ? current : new Set([...current, id])); onInteractiveProgress?.(id); }} /></InteractionPopupSurface>;
}
