"use client";

import type { ReactNode } from "react";
import { CirclePlay } from "lucide-react";
import { PreviewImage } from "../../../../preview-image";
import { InteractiveAccordion, InteractiveFlipCard, InteractiveKnowledgeCheck, InteractiveLabeledGraphic, InteractiveProcessSteps, InteractiveSurvey } from "../../../../interactive-blocks";
import type { ContentBlock } from "@/lib/schemas/block";
import { ImageBlockLayout } from "../../../../../edit/_components/image-block-layout";
import { StatementBlockPreview } from "../../../../../edit/_components/statement-block-preview";
import { StatementTextPreview } from "../../../../../edit/_components/statement-text-preview";
import { ChartBlockPreview } from "../../../../chart-block";
import { getInteractiveItemProgressId } from "@/lib/export/progress";
import { blockSurfaceStyle, blockWidthClass } from "../../preview-utils";
import type { PreviewDevice, PreviewOrientation } from "../../preview-types";
export function PreviewBlock({
  block,
  device,
  orientation,
  animateListItems = false,
  interactedContentIds,
  onInteractiveProgress,
}: {
  block: ContentBlock;
  device: PreviewDevice;
  orientation: PreviewOrientation;
  animateListItems?: boolean;
  interactedContentIds?: ReadonlySet<string>;
  onInteractiveProgress?: (progressId: string) => void;
}) {
  const widthClass = blockWidthClass(block);
  const style = blockSurfaceStyle(block);

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
                borderTopColor: block.data.lineColor ?? "#cbd5e1",
              }}
            />
          ) : (
            <div aria-hidden="true" className="h-8" />
          )}
        </div>
      </div>
    );
  }

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
    const compactText = device === "mobile" && orientation === "portrait";
    content = (
      <StatementTextPreview
        tag="p"
        text=""
        html={block.data.html}
        className={`prose max-w-none ${compactText ? "text-sm leading-6" : "text-base leading-7"} [&_p]:my-3 [&_h1]:my-5 [&_h2]:my-4 [&_h3]:my-3 ${animateListItems ? "lesson-list-enter" : ""}`}
      />
    );
  } else if (block.type === "statement") {
    content = (
      <StatementBlockPreview
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
          <PreviewImage
            key={`${block.id}-${index}`}
            src={image.src}
            alt={image.alt}
            className="aspect-[4/3] w-full rounded-lg object-cover"
          />
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
        onEnded={() => onInteractiveProgress?.(`${block.id}:watched`)}
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
        onClick={() => onInteractiveProgress?.(`${block.id}:watched`)}
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
        blockId={block.id}
        cards={block.data.cards}
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
        blockId={block.id}
        src={block.data.src}
        alt={block.data.alt}
        markers={block.data.markers}
        markerColor={block.data.markerColor}
        textColor={block.data.textColor}
        radarColor={block.data.radarColor}
        onMarkerInteract={(markerId) =>
          onInteractiveProgress?.(
            getInteractiveItemProgressId(block.id, "marker", markerId),
          )
        }
      />
    );
  } else if (block.type === "processSteps") {
    content = (
      <InteractiveProcessSteps
        blockId={block.id}
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

  return (
    <div className="w-full" style={style}>
      <div className={`mx-auto w-full ${widthClass} px-4`}>{content}</div>
    </div>
  );
}
