"use client";
import { borderPaint } from "@/lib/color";

import type { ReactNode } from "react";
import { CirclePlay } from "lucide-react";
import { PreviewImage } from "../../../../preview-image";
import { AudioPlayer } from "@/components/audio-player";
import { useRequiredMediaPlayback } from "@/components/use-required-media-playback";
import { useMediaProgress } from "@/components/media-progress-context";
import type { MediaPlaybackProgress as PlaybackProgress } from "@/lib/export/media-playback";
import { FileAttachmentLink } from "@/components/file-attachment-link";
import { CourseLinkBlock } from "@/components/course-link-block";
import { InteractiveAccordion, InteractiveFlipCard, InteractiveKnowledgeCheck, InteractiveLabeledGraphic, InteractiveProcessSteps, InteractiveSurvey } from "../../../../interactive-blocks";
import type { ContentBlock } from "@/lib/schemas/block";
import { isSlideMediaObject } from "@/lib/editor/slide-objects";
import { SlideMediaObject } from "@/app/courses/[courseId]/_components/slide-presentation/slide-media-object";
import { SlideGallery } from "@/app/courses/[courseId]/_components/slide-presentation/slide-gallery";
import { BalloonArcher } from "@/components/balloon-archer";
import { PeelToReveal } from "@/components/physics-interaction/peel-to-reveal";
import { HangingRopeCards } from "@/components/physics-interaction/hanging-rope-cards";
import { SlideMediaPlayer } from "@/app/courses/[courseId]/_components/slide-presentation/slide-media-player";
import { SlideTextBox } from "@/app/courses/[courseId]/_components/slide-presentation/slide-text-box";
import { ImageBlockLayout } from "../../../../../edit/_components/image-block-layout";
import { StatementBlockPreview } from "../../../../../edit/_components/statement-block-preview";
import { StatementTextPreview } from "../../../../../edit/_components/statement-text-preview";
import { ChartBlockPreview } from "../../../../chart-block";
import { InteractiveLessonMap } from "@/components/lesson-map";
import { getInteractiveItemProgressId } from "@/lib/export/progress";
import { blockSurfaceStyle, blockWidthClass } from "../../preview-utils";
import { AudioInstruction } from "@/app/courses/[courseId]/_components/slide-presentation/audio-instruction";
import { InteractionButton } from "@/app/courses/[courseId]/_components/slide-presentation/interaction-button";
import { InteractionPopupContent } from "@/app/courses/[courseId]/_components/slide-presentation/interaction-popup-content";
import { isInteractionTarget, scopePopupBlocks } from "@/lib/editor/interaction-button";
import type { PreviewDevice, PreviewOrientation } from "../../preview-types";
export function PreviewBlock({
  block,
  device,
  orientation,
  slideLayout = false,
  animateListItems = false,
  interactedContentIds,
  onInteractiveProgress,
  onMediaDurationChange,
  lessons = [],
  visitedLessonIds = new Set(),
  passedQuizIds = new Set(),
  getLessonNavigationLockMessage = () => null,
  onOpenLesson = () => {},
  lessonBlocks = [], authoring = false, decorative = false,
}: {
  block: ContentBlock;
  device: PreviewDevice;
  orientation: PreviewOrientation;
  slideLayout?: boolean;
  animateListItems?: boolean;
  interactedContentIds?: ReadonlySet<string>;
  onInteractiveProgress?: (progressId: string) => void;
  onMediaDurationChange?: (duration: number | null) => void;
  lessons?: { id: string; title: string; sectionId: string; order: number; lessonType?: "content" | "quiz" }[];
  visitedLessonIds?: ReadonlySet<string>;
  passedQuizIds?: ReadonlySet<string>;
  getLessonNavigationLockMessage?: (lessonId: string) => string | null;
  onOpenLesson?: (lessonId: string) => void;
  lessonBlocks?: readonly ContentBlock[];
  authoring?: boolean;
  decorative?: boolean;
}) {
  const mediaProgressId = `${block.id}:${block.type === "video" ? "watched" : "listened"}`;
  const { mediaProgress, reportMediaProgress } = useMediaProgress();
  const completed = interactedContentIds?.has(mediaProgressId) ?? false;
  const trackProgress = slideLayout && !authoring && !decorative && (block.type === "video" || block.type === "audio");
  const requireFullPlayback = !authoring && !decorative && block.requiredForProgress !== false && !completed;
  const tracking = { trackProgress, completed, initialProgress: mediaProgress[mediaProgressId], onProgress: (progress: PlaybackProgress) => reportMediaProgress(mediaProgressId, progress) };
  const { events: videoPlayback } = useRequiredMediaPlayback(block.type === "video" ? block.data.src : "", requireFullPlayback, () => onInteractiveProgress?.(mediaProgressId), !authoring && !decorative, { enabled: trackProgress && block.type === "video", completed, initial: tracking.initialProgress, onProgress: tracking.onProgress });
  const widthClass = blockWidthClass(block);
  const style = blockSurfaceStyle(block, slideLayout);
  if (block.type === "hangingRopeCards") {
    const cards = <HangingRopeCards blockId={block.id} data={block.data} presentation={slideLayout} authoring={authoring} decorative={decorative} interactedContentIds={interactedContentIds} onProgress={onInteractiveProgress} renderContent={(card) => card.blocks.map((content) => <PreviewBlock key={content.id} block={{ ...content, id: `${block.id}-rope-${card.id}-${content.id}` }} device={device} orientation={orientation} authoring={authoring} decorative={decorative} />)} />;
    return slideLayout ? cards : <div className="w-full" style={style}><div className={`mx-auto w-full ${widthClass} px-4`}>{cards}</div></div>;
  }
  if (block.type === "peelToReveal") {
    const interaction = <PeelToReveal blockId={block.id} settings={block.data} presentation={slideLayout} authoring={authoring} decorative={decorative} interactedContentIds={interactedContentIds} onProgress={onInteractiveProgress}>{block.data.blocks.map((content) => <PreviewBlock key={content.id} block={{ ...content, id: `${block.id}-reveal-${content.id}` }} device={device} orientation={orientation} authoring={authoring} decorative={decorative} />)}</PeelToReveal>;
    return slideLayout ? interaction : <div className="w-full" style={style}><div className={`mx-auto w-full ${widthClass} px-4`}>{interaction}</div></div>;
  }
  if (block.type === "balloonArcher") {
    const game = <BalloonArcher blockId={block.id} data={block.data} presentation={slideLayout} authoring={authoring} decorative={decorative} interactedContentIds={interactedContentIds} onProgress={onInteractiveProgress} />;
    return slideLayout ? game : <div className="w-full" style={style}><div className={`mx-auto w-full ${widthClass} px-4`}>{game}</div></div>;
  }
  if (block.type === "audioInstruction") return <AudioInstruction key={block.data.src} block={block} presentation={slideLayout} authoring={authoring} onEnded={() => onInteractiveProgress?.(`${block.id}:listened`)} />;
  if (block.type === "interactionButton") {
    const target = lessonBlocks.find((item) => item.id === block.data.targetBlockId && isInteractionTarget(item, block.id));
    const popupBlocks: ContentBlock[] = block.data.action === "popup" ? scopePopupBlocks(block.data.popup.blocks, block.id) : target ? [{ ...target, slideFrame: { x: 5, y: 5, width: 90, height: 90, z: 0 } }] : [];
    return <InteractionButton block={block} presentation={slideLayout} authoring={authoring} available={popupBlocks.length > 0} onOpen={() => onInteractiveProgress?.(`${block.id}:opened`)}><InteractionPopupContent popup={block.data.popup} blocks={popupBlocks} device={device} orientation={orientation} authoring={authoring} lessons={lessons} visitedLessonIds={visitedLessonIds} passedQuizIds={passedQuizIds} getLessonNavigationLockMessage={getLessonNavigationLockMessage} onOpenLesson={onOpenLesson} interactedContentIds={interactedContentIds} onInteractiveProgress={block.data.action === "block" ? onInteractiveProgress : undefined} /></InteractionButton>;
  }

  if (block.type === "divider") {
    return (
      <div className="w-full" style={style}>
        <div className={`mx-auto w-full ${widthClass} px-4`}>
          {block.data.style === "line" ? (
            <hr
              className="m-0 w-full border-0"
              style={{
                borderTopWidth: `${block.data.lineWeight ?? 1}px`,
                borderTopStyle: block.data.lineStyle ?? "solid",
                ...borderPaint(block.data.lineColor ?? "#cbd5e1"),
              }}
            />
          ) : (
            <div aria-hidden="true" className="h-8" />
          )}
        </div>
      </div>
    );
  }

  if (slideLayout && isSlideMediaObject(block)) {
    return <SlideMediaObject block={block} {...tracking} requireFullPlayback={requireFullPlayback} onDurationChange={onMediaDurationChange} onVideoEnded={() => onInteractiveProgress?.(`${block.id}:watched`)} />;
  }

  if (slideLayout && block.type === "gallery") return <SlideGallery images={block.data.images} />;
  if (slideLayout && block.type === "audio") return <SlideMediaPlayer key={block.data.src} block={block} {...tracking} requireFullPlayback={requireFullPlayback} decorative={decorative} onDurationChange={onMediaDurationChange} onEnded={() => onInteractiveProgress?.(`${block.id}:listened`)} />;

  let content: ReactNode;
  if (block.type === "heading") {
    const compactText = device === "mobile" && orientation === "portrait";
    content = (
      <StatementTextPreview
        tag="h3"
        text={block.data.text}
        html={block.data.html}
        className={`${compactText ? "text-2xl [&_h1]:text-3xl [&_h2]:text-2xl [&_h3]:text-xl [&_p]:text-2xl" : "text-3xl [&_h1]:text-4xl [&_h2]:text-2xl [&_h3]:text-2xl [&_p]:text-3xl"} font-semibold tracking-tight [&_h1]:my-0 [&_h2]:my-0 [&_h3]:my-0 [&_p]:my-0 [&_p]:font-semibold [&_h2]:font-bold`}
      />
    );
  } else if (block.type === "richText") {
    const compactText = !slideLayout && device === "mobile" && orientation === "portrait";
    content = (
      <StatementTextPreview
        tag="p"
        text=""
        html={block.data.html}
        matchEditorSpacing={slideLayout}
        className={slideLayout ? `prose max-w-none ${animateListItems ? "lesson-list-enter" : ""}` : `prose max-w-none ${compactText ? "text-sm leading-6" : "text-base leading-7"} [&_p]:my-3 [&_h1]:my-5 [&_h2]:my-4 [&_h3]:my-3 ${animateListItems ? "lesson-list-enter" : ""}`}
      />
    );
  } else if (block.type === "audio") {
    content = <AudioPlayer src={block.data.src} fileName={block.data.fileName} {...tracking} requireFullPlayback={requireFullPlayback} onEnded={() => onInteractiveProgress?.(`${block.id}:listened`)} />;
  } else if (block.type === "attachment") {
    content = <FileAttachmentLink href={block.data.src} fileName={block.data.fileName} size={block.data.size} />;
  } else if (block.type === "link") {
    content = <CourseLinkBlock data={block.data} />;
  } else if (block.type === "statement") {
    content = (
      <StatementBlockPreview
        transparentSurface={slideLayout}
        style={block.data.style}
        title={block.data.title}
        body={block.data.body}
        titleHtml={block.data.titleHtml}
        bodyHtml={block.data.bodyHtml}
      />
    );
  } else if (block.type === "chart") {
    content = <ChartBlockPreview data={block.data} />;
  } else if (block.type === "image") {
    const imageLayout = block.data.layout ?? "full";
    const imageClassName = imageLayout === "full"
      ? "max-h-[640px] w-full rounded-lg object-contain"
      : "h-full w-full object-cover";
    content = (
      <ImageBlockLayout
        layout={imageLayout}
        title={block.data.title}
        body={block.data.body}
        caption={block.data.caption}
        image={<PreviewImage src={block.data.src} alt={block.data.alt} className={imageClassName} caption={block.data.caption} />}
      />
    );
  } else if (block.type === "gallery") {
    const columns =
      block.data.images.length === 1
        ? "grid-cols-1"
        : device === "mobile"
          ? "grid-cols-1"
          : block.data.images.length === 2
            ? "grid-cols-2"
            : "grid-cols-2 lg:grid-cols-3";
    content = (
      <div className={`grid ${columns} gap-3`}>
        {block.data.images.map((image, index) => (
          <div key={`${block.id}-${index}`} data-slide-animation-item className="min-w-0"><PreviewImage
            src={image.src}
            alt={image.alt}
            className="aspect-[4/3] w-full rounded-lg object-cover"
          /></div>
        ))}
      </div>
    );
  } else if (block.type === "video") {
    const isVideoFile =
      Boolean(block.data.mimeType) ||
      /\.(mp4|webm|ogg)(?:$|[?#])/i.test(block.data.src);
    content = isVideoFile ? (
      <video
        controls
        className="aspect-video w-full rounded-xl bg-black"
        src={block.data.src}
        {...videoPlayback}
      >
        {block.data.captions && (
          <track
            kind="captions"
            src={block.data.captions}
            srcLang="en"
            label="Captions"
          />
        )}
      </video>
    ) : (
      <a
        href={block.data.src}
        target="_blank"
        rel="noreferrer"
          className="flex aspect-video w-full items-center justify-center gap-3 rounded-xl bg-slate-950 text-white hover:bg-slate-900"
      >
        <span className="grid size-14 place-items-center rounded-full bg-white/15">
          <CirclePlay size={27} />
        </span>
        <span className="text-sm font-medium">Open video</span>
      </a>
    );
  } else if (block.type === "flipCard") {
    content = (
      <InteractiveFlipCard
        presentation={slideLayout}
        blockId={block.id}
        cards={block.data.cards}
        presentationLayout={block.data.presentationLayout}
        cardsPerRow={block.data.cardsPerRow}
        cardStyle={block.data.cardStyle}
        cardBackgroundColor={block.data.cardBackgroundColor}
        cardTextColor={block.data.cardTextColor}
        interactedCardIds={interactedContentIds}
        onCardReveal={onInteractiveProgress}
      />
    );
  } else if (block.type === "accordion") {
    content = (
      <InteractiveAccordion
        blockId={block.id}
        layout={block.data.layout}
        displayMode={block.data.displayMode}
        items={block.data.items}
        onItemInteract={(itemId) =>
          onInteractiveProgress?.(
            getInteractiveItemProgressId(block.id, "section", itemId),
          )
        }
      />
    );
  } else if (block.type === "labeledGraphic") {
    content = (
      <InteractiveLabeledGraphic
        key={`${block.id}:${block.data.sceneTheme ?? ""}:${block.data.challengePrompt ?? ""}`}
        presentation={slideLayout}
        blockId={block.id}
        src={block.data.src}
        alt={block.data.alt}
        markers={block.data.markers}
        mapTemplate={block.data.mapTemplate}
        objectFit={block.data.objectFit}
        markerColor={block.data.markerColor}
        textColor={block.data.textColor}
        radarColor={block.data.radarColor}
        radarSize={block.data.radarSize}
        radarWeight={block.data.radarWeight}
        interactionMode={block.data.interactionMode}
        sceneTheme={block.data.sceneTheme}
        challengePrompt={block.data.challengePrompt}
        successMessage={block.data.successMessage}
        onMarkerInteract={(markerId) =>
          onInteractiveProgress?.(
            getInteractiveItemProgressId(block.id, "marker", markerId),
          )
        }
      />
    );
  } else if (block.type === "lessonMap") {
    content = (
      <InteractiveLessonMap
        block={block}
        lessons={lessons}
        visitedLessonIds={visitedLessonIds}
        passedQuizIds={passedQuizIds}
        getLessonNavigationLockMessage={getLessonNavigationLockMessage}
        onOpenLesson={onOpenLesson}
      />
    );
  } else if (block.type === "processSteps") {
    content = (
      <InteractiveProcessSteps
        blockId={block.id}
        presentation={slideLayout}
        steps={block.data.steps}
        style={block.data.style}
        accentColor={block.data.accentColor}
        showNumbers={block.data.showNumbers}
        onStepInteract={(stepId) =>
          onInteractiveProgress?.(
            getInteractiveItemProgressId(block.id, "step", stepId),
          )
        }
      />
    );
  } else if (block.type === "knowledgeCheck") {
    content = (
      <InteractiveKnowledgeCheck
        blockId={block.id}
        question={block.data.question}
        options={block.data.options}
        correctOptionIndex={block.data.correctOptionIndex ?? 0}
        correctFeedback={block.data.correctFeedback ?? "Correct!"}
        incorrectFeedback={block.data.incorrectFeedback ?? "Not quite. Try again."}
        onAnswerChecked={() => onInteractiveProgress?.(`${block.id}:answer`)}
      />
    );
  } else {
    content = (
      <InteractiveSurvey
        blockId={block.id}
        question={block.data.question}
        minLabel={block.data.minLabel}
        maxLabel={block.data.maxLabel}
        onSubmit={() => onInteractiveProgress?.(`${block.id}:submitted`)}
      />
    );
  }

  if (slideLayout && (block.type === "heading" || block.type === "richText" || block.type === "statement")) {
    return <SlideTextBox block={block}>{content}</SlideTextBox>;
  }

  if (slideLayout && (block.type === "flipCard" || (block.type === "labeledGraphic" && block.data.interactionMode !== "spotTarget"))) {
    return <div className="h-full w-full">{content}</div>;
  }

  return (
    <div className="w-full" style={style}>
      <div className={`mx-auto w-full ${widthClass} px-4`}>{content}</div>
    </div>
  );
}
