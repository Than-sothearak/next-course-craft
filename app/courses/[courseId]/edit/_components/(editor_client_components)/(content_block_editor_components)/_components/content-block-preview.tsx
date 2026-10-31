"use client";
import { borderPaint } from "@/lib/color";

import Image from "next/image";
import { LockKeyhole, Play } from "lucide-react";
import type { ContentBlock } from "@/lib/schemas/block";
import { AudioPlayer } from "@/components/audio-player";
import { FileAttachmentLink } from "@/components/file-attachment-link";
import { CourseLinkBlock } from "@/components/course-link-block";
import { InputBlockPreview } from "../../input-block-preview";
import { InteractiveAccordion, InteractiveFlipCard, InteractiveLabeledGraphic, InteractiveProcessSteps } from "../../../../../preview/interactive-blocks";
import { ImageBlockLayout } from "../../../image-block-layout";
import { ChartBlockPreview } from "../../../../../preview/chart-block";
import { PreviewBlock as LearnerBlock } from "../../../../../preview/_components/(course_preview_components)/(lesson_reader_preview_components)/(lesson_blocks_preview_components)/preview-block";

type PreviewBlock = Exclude<ContentBlock, { type: "heading" | "richText" | "statement" | "lessonMap" }>;

export function ContentBlockPreview({ block, onChange, presentation = false }: { block: PreviewBlock; onChange: (block: ContentBlock) => void; presentation?: boolean }) {
  return (block.type === "interactionButton" || block.type === "audioInstruction") ? <LearnerBlock block={block} device="desktop" orientation="landscape" slideLayout={presentation} authoring /> : block.type === "link" ? (
    <CourseLinkBlock data={block.data} interactive={false} />
  ) : block.type === "audio" ? (
    <AudioPlayer src={block.data.src} fileName={block.data.fileName} />
  ) : block.type === "attachment" ? (
    <FileAttachmentLink href={block.data.src} fileName={block.data.fileName} size={block.data.size} />
  ) : block.type === "chart" ? (
    <ChartBlockPreview data={block.data} />
  ) : block.type === "image" ? (
    <ImageBlockLayout
      layout={block.data.layout}
      title={block.data.title}
      body={block.data.body}
      caption={block.data.caption}
      editable={
        block.data.layout === "text-left" ||
        block.data.layout === "text-right" ||
        block.data.layout === "text-overlay" ||
        block.data.layout === "card"
      }
      onTitleChange={(title) =>
        onChange({ ...block, data: { ...block.data, title } })
      }
      onBodyChange={(body) =>
        onChange({ ...block, data: { ...block.data, body } })
      }
      image={
        <Image
          src={block.data.src}
          alt={block.data.alt}
          width={1200}
          height={675}
          unoptimized
          className={
            block.data.layout === "full" || !block.data.layout
              ? "max-h-[520px] w-full object-contain"
              : "h-full w-full object-cover"
          }
        />
      }
    />
  ) : block.type === "gallery" ? (
    <div
      className={`grid gap-3 ${block.data.images.length === 1 ? "grid-cols-1" : block.data.images.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}
    >
      {block.data.images.map((image, index) => (
        <figure
          key={`${block.id}-image-${index}`}
          className="min-w-0 overflow-hidden rounded-lg"
        >
          <Image
            src={image.src}
            alt={image.alt}
            width={480}
            height={360}
            unoptimized
            className="aspect-[4/3] w-full object-cover"
          />
        </figure>
      ))}
    </div>
  ) : block.type === "video" ? (
    block.data.mimeType ||
      /\.(mp4|webm|ogg)(?:$|[?#])/i.test(block.data.src) ? (
      <video
        controls
        className="aspect-video w-full rounded-xl bg-black"
        src={block.data.src}
      />
    ) : (
      <a
        href={block.data.src}
        target="_blank"
        rel="noreferrer"
        className="flex aspect-video w-full items-center justify-center gap-3 rounded-xl bg-slate-950 text-white hover:bg-slate-900"
      >
        <span className="grid size-12 place-items-center rounded-full bg-white/15">
          <Play size={22} fill="currentColor" />
        </span>
        <span className="text-sm font-medium">Open video</span>
      </a>
    )
  ) : block.type === "divider" ? (
    block.data.style === "line" ? (
      <hr
        className="m-0 w-full border-0"
        style={{
          borderTopWidth: `${block.data.lineWeight ?? 1}px`,
          borderTopStyle: block.data.lineStyle ?? "solid",
          ...borderPaint(block.data.lineColor ?? "#cbd5e1"),
        }}
      />
    ) : block.data.style === "space" ? (
      <div aria-hidden="true" className="h-8" />
    ) : (
      <div className="flex justify-center">
        <span
          className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-sm"
          style={{ backgroundColor: "var(--course-primary, #2f5f9f)" }}
        >
          {block.data.completionType === "completeAbove" && (
            <LockKeyhole aria-hidden="true" className="size-4" />
          )}
          {block.data.label}
        </span>
      </div>
    )
  ) : block.type === "flipCard" ? (
    <InteractiveFlipCard
      blockId={block.id}
      cards={block.data.cards}
      cardsPerRow={block.data.cardsPerRow}
      cardStyle={block.data.cardStyle}
      cardBackgroundColor={block.data.cardBackgroundColor}
      cardTextColor={block.data.cardTextColor}
    />
  ) : block.type === "accordion" ? (
    <InteractiveAccordion
      blockId={block.id}
      layout={block.data.layout}
      displayMode={block.data.displayMode}
      items={block.data.items}
    />
  ) : block.type === "labeledGraphic" ? (
    <InteractiveLabeledGraphic
      key={`${block.id}:${block.data.sceneTheme ?? ""}:${block.data.challengePrompt ?? ""}:${block.data.markers.map((marker) => `${marker.id}-${marker.isTarget ? "target" : "option"}`).join(":")}`}
      blockId={block.id}
      src={block.data.src}
      alt={block.data.alt}
      mapTemplate={block.data.mapTemplate}
      objectFit={block.data.objectFit}
      presentation={presentation}
      markers={block.data.markers}
      markerColor={block.data.markerColor}
      textColor={block.data.textColor ?? "#ffffff"}
      radarColor={block.data.radarColor}
      radarSize={block.data.radarSize}
      radarWeight={block.data.radarWeight}
      interactionMode={block.data.interactionMode}
      sceneTheme={block.data.sceneTheme}
      challengePrompt={block.data.challengePrompt}
      successMessage={block.data.successMessage}
      editable
      onMarkerChange={(markerId, update) => onChange({ ...block, data: { ...block.data, markers: block.data.markers.map((marker) => marker.id === markerId ? { ...marker, ...update } : marker) } })}
      onMarkerPositionChange={(markerId, position) => onChange({
        ...block,
        data: {
          ...block.data,
          markers: block.data.markers.map((marker) =>
            marker.id === markerId ? { ...marker, ...position } : marker,
          ),
        },
      })}
    />
  ) : block.type === "processSteps" ? (
    <InteractiveProcessSteps blockId={block.id} steps={block.data.steps} style={block.data.style} accentColor={block.data.accentColor} showNumbers={block.data.showNumbers} />
  ) : block.type === "knowledgeCheck" ? (
    <InputBlockPreview
      type="knowledgeCheck"
      question={block.data.question}
      options={block.data.options}
      correctOptionIndex={block.data.correctOptionIndex}
    />
  ) : (
    <InputBlockPreview
      type="survey"
      question={block.data.question}
      minLabel={block.data.minLabel}
      maxLabel={block.data.maxLabel}
    />
  );
}
