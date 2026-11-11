"use client";

import { useEffect, useRef, useState } from "react";
import { LayoutGrid, Settings2 } from "lucide-react";
import type { ContentBlock } from "@/lib/schemas/block";
import { Button } from "@/components/ui/button";
import { HeadingBlockEditor } from "./(content_block_editor_components)/heading-block-editor";
import { RichTextBlockEditor } from "./(content_block_editor_components)/rich-text-block-editor";
import { StatementContentEditor } from "./(content_block_editor_components)/statement-content-editor";
import { LessonMapEditor } from "@/components/lesson-map";
import { DraggableSettingsPanel } from "./draggable-settings-panel";
import { MediaLibraryDialog, type MediaLibraryAsset } from "../media-library-dialog";
import type { FlipCard, FlipCardSide, FlipCardFace, MediaLibraryTarget } from "./(content_block_editor_components)/_components/content-block-types";
import { LinkBlockSettings } from "./(content_block_editor_components)/_components/block-settings/link-block-settings";
import { ChartBlockSettings } from "./(content_block_editor_components)/_components/block-settings/chart-block-settings";
import { ImageBlockSettings } from "./(content_block_editor_components)/_components/block-settings/image-block-settings";
import { GalleryBlockSettings } from "./(content_block_editor_components)/_components/block-settings/gallery-block-settings";
import { VideoBlockSettings } from "./(content_block_editor_components)/_components/block-settings/video-block-settings";
import { AudioBlockSettings } from "./(content_block_editor_components)/_components/block-settings/audio-block-settings";
import { audioBlockSchema } from "@/lib/schemas/block";
import { AttachmentBlockSettings } from "./(content_block_editor_components)/_components/block-settings/attachment-block-settings";
import { DividerBlockSettings } from "./(content_block_editor_components)/_components/block-settings/divider-block-settings";
import { FlipCardBlockSettings } from "./(content_block_editor_components)/_components/block-settings/flip-card-block-settings";
import { AccordionBlockSettings } from "./(content_block_editor_components)/_components/block-settings/accordion-block-settings";
import { LabeledGraphicBlockSettings } from "./(content_block_editor_components)/_components/block-settings/labeled-graphic-block-settings";
import { ProcessStepsBlockSettings } from "./(content_block_editor_components)/_components/block-settings/process-steps-block-settings";
import { KnowledgeCheckBlockSettings } from "./(content_block_editor_components)/_components/block-settings/knowledge-check-block-settings";
import { SurveyBlockSettings } from "./(content_block_editor_components)/_components/block-settings/survey-block-settings";
import { ContentBlockPreview } from "./(content_block_editor_components)/_components/content-block-preview";
import { AudioInstructionSettings } from "./audio-instruction-settings";
import { InteractionButtonSettings } from "./interaction-button-settings";
import { BalloonArcherSettings } from "@/components/balloon-archer/balloon-archer-settings";
import { PeelSettingsEditor } from "@/components/physics-interaction/peel-settings";
import { HangingRopeSettingsEditor } from "@/components/physics-interaction/hanging-rope-settings";
import { BlockProgressControls } from "@/components/block-progress-controls";
import { getInteractiveBlockProgressIds } from "@/lib/export/progress";

export function ContentBlockEditor({
  block,
  courseId,
  onChange,
  onReplaceTemplate,
  sections = [],
  lessons = [],
  saveState = "saved",
  hasUnsavedChanges = false,
  saveMessage = "",
  onRetrySave = () => {},
  inlineSettings = false,
  lessonBlocks = [],
}: {
  block: ContentBlock;
  courseId: string;
  onChange: (block: ContentBlock) => void;
  onReplaceTemplate?: () => void;
  sections?: { id: string; title: string; order: number }[];
  lessons?: { id: string; title: string; sectionId: string; order: number; lessonType?: "content" | "quiz" }[];
  saveState?: "saved" | "saving" | "error" | "conflict";
  hasUnsavedChanges?: boolean;
  saveMessage?: string;
  onRetrySave?: () => void;
  inlineSettings?: boolean;
  lessonBlocks?: readonly ContentBlock[];
}) {
  const [editing, setEditing] = useState(false);
  const [mediaLibraryTarget, setMediaLibraryTarget] = useState<MediaLibraryTarget | null>(null);
  const [selectedGalleryImageIndex, setSelectedGalleryImageIndex] = useState<
    number | null
  >(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const settingsPanelId = `content-settings-${block.id}`;
  useEffect(() => {
    if (!editing) return;
    function closeOnOutsidePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (
        settingsButtonRef.current?.contains(target) ||
        (target instanceof Element && target.closest("[data-media-library]")) ||
        document.getElementById(settingsPanelId)?.contains(target)
      )
        return;
      setEditing(false);
    }
    document.addEventListener("pointerdown", closeOnOutsidePointerDown);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsidePointerDown);
  }, [editing, settingsPanelId]);

  function selectMedia(asset: MediaLibraryAsset) {
    if (block.type === "image")
      onChange({ ...block, data: { ...block.data, src: asset.fileUrl } });
    if (block.type === "video")
      onChange({
        ...block,
        data: {
          ...block.data,
          src: asset.fileUrl,
          mimeType: asset.contentType as "video/mp4" | "video/webm",
        },
      });
    if (block.type === "audio") {
      const selected = audioBlockSchema.safeParse({
        ...block,
        data: { src: asset.fileUrl, fileName: asset.originalName, mimeType: asset.contentType },
      });
      if (!selected.success) return;
      onChange(selected.data);
    }
    if (block.type === "attachment")
      onChange({
        ...block,
        data: { src: asset.fileUrl, fileName: asset.originalName, size: asset.size },
      });
    if (block.type === "gallery" && selectedGalleryImageIndex !== null) {
      onChange({
        ...block,
        data: {
          ...block.data,
          images: block.data.images.map((image, index) =>
            index === selectedGalleryImageIndex
              ? { ...image, src: asset.fileUrl }
              : image,
          ),
        },
      });
    }
    if (block.type === "labeledGraphic" && mediaLibraryTarget === "labeledGraphic") {
      onChange({ ...block, data: { ...block.data, src: asset.fileUrl, mapTemplate: undefined } });
    }
    if (block.type === "flipCard" && mediaLibraryTarget && typeof mediaLibraryTarget === "object") {
      onChange({
        ...block,
        data: {
          ...block.data,
          cards: block.data.cards.map((card) =>
            card.id !== mediaLibraryTarget.cardId
              ? card
              : {
                  ...card,
                  [mediaLibraryTarget.side]: {
                    type: "image",
                    src: asset.fileUrl,
                    alt: "",
                  },
                },
          ),
        },
      });
    }
    setMediaLibraryTarget(null);
    setSelectedGalleryImageIndex(null);
  }

  function updateFlipCard(cardId: string, update: (card: FlipCard) => FlipCard) {
    if (block.type !== "flipCard") return;
    onChange({
      ...block,
      data: {
        ...block.data,
        cards: block.data.cards.map((card) => card.id === cardId ? update(card) : card),
      },
    });
  }

  function updateFlipCardFace(cardId: string, side: FlipCardSide, face: FlipCardFace) {
    updateFlipCard(cardId, (card) => ({ ...card, [side]: face }));
  }

  function replaceTemplateAction() {
    if (!onReplaceTemplate) return null;
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          setEditing(false);
          onReplaceTemplate?.();
        }}
        className="mb-3 w-full justify-start"
      >
        <LayoutGrid size={14} />
        Change block style
      </Button>
    );
  }

  function settingsButton() {
    return (
      <Button
        ref={settingsButtonRef}
        type="button"
        variant="ghost"
        size="icon"
        aria-label={
          editing ? "Close content settings" : "Open content settings"
        }
        aria-expanded={editing}
        aria-controls={`content-settings-${block.id}`}
        onClick={() => setEditing((current) => !current)}
        style={{
          left: "max(-80px, calc((100% - 100vw) / 2 + 8px))",
          top: "4px",
        }}
        className={`absolute z-40 size-8 rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition-opacity hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 ${editing ? "md:opacity-100" : ""}`}
      >
        <Settings2 size={16} />
      </Button>
    );
  }

  function styleSettingsPanel() {
    if (inlineSettings) return <div className="space-y-3">{replaceTemplateAction()}</div>;
    return (
      editing && (
        <DraggableSettingsPanel
          id={settingsPanelId}
          title="Content settings"
          side="left"
          anchorRef={settingsButtonRef}
          panelClassName="w-[min(280px,calc(100vw-3rem))]"
        >
          {replaceTemplateAction()}
        </DraggableSettingsPanel>
      )
    );
  }

  if (block.type === "heading")
    return (
      <div className="group relative">
        {!inlineSettings && settingsButton()}
        {styleSettingsPanel()}
        <HeadingBlockEditor block={block} onChange={onChange} />
      </div>
    );
  if (block.type === "richText")
    return (
      <div className="group relative">
        {!inlineSettings && settingsButton()}
        {styleSettingsPanel()}
        <RichTextBlockEditor
          block={block}
          onChange={(html) => onChange({ ...block, data: { html } })}
        />
      </div>
    );
  if (block.type === "statement")
    return (
      <div className="group relative">
        {!inlineSettings && settingsButton()}
        {styleSettingsPanel()}
        <StatementContentEditor block={block} onChange={onChange} />
      </div>
    );
  if (block.type === "lessonMap")
    return (
      <div className="space-y-3">{inlineSettings && replaceTemplateAction()}<LessonMapEditor
        block={block}
        sections={sections}
        lessons={lessons}
        saveState={saveState}
        hasUnsavedChanges={hasUnsavedChanges}
        saveMessage={saveMessage}
        onRetrySave={onRetrySave}
        onChange={(next) => onChange(next)}
      /></div>
    );

  const preview = <ContentBlockPreview block={block} courseId={courseId} onChange={onChange} />;
  const hasProgressRequirement =
    getInteractiveBlockProgressIds(block, lessonBlocks).length > 0 ||
    (block.type === "divider" && block.data.style === "continue");
  const settingsContent = <>
    {replaceTemplateAction()}
    {block.type === "link" && <LinkBlockSettings block={block} onChange={onChange} />}
    {block.type === "chart" && <ChartBlockSettings block={block} onChange={onChange} />}
    {block.type === "image" && <ImageBlockSettings block={block} onChange={onChange} setMediaLibraryTarget={setMediaLibraryTarget} />}
    {block.type === "gallery" && <GalleryBlockSettings block={block} setSelectedGalleryImageIndex={setSelectedGalleryImageIndex} setMediaLibraryTarget={setMediaLibraryTarget} onChange={onChange} />}
    {block.type === "video" && <VideoBlockSettings setMediaLibraryTarget={setMediaLibraryTarget} block={block} onChange={onChange} />}
    {block.type === "audio" && <AudioBlockSettings setMediaLibraryTarget={setMediaLibraryTarget} block={block} onChange={onChange} />}
    {block.type === "attachment" && <AttachmentBlockSettings setMediaLibraryTarget={setMediaLibraryTarget} block={block} />}
    {block.type === "divider" && <DividerBlockSettings block={block} onChange={onChange} />}
    {block.type === "flipCard" && <FlipCardBlockSettings presentation={inlineSettings} block={block} onChange={onChange} updateFlipCard={updateFlipCard} updateFlipCardFace={updateFlipCardFace} setMediaLibraryTarget={setMediaLibraryTarget} />}
    {block.type === "accordion" && <AccordionBlockSettings block={block} onChange={onChange} />}
    {block.type === "labeledGraphic" && <LabeledGraphicBlockSettings block={block} onChange={onChange} setMediaLibraryTarget={setMediaLibraryTarget} presentation={inlineSettings} />}
    {block.type === "processSteps" && <ProcessStepsBlockSettings block={block} courseId={courseId} onChange={onChange} />}
    {block.type === "balloonArcher" && <BalloonArcherSettings block={block} onChange={onChange} />}
    {block.type === "peelToReveal" && <PeelSettingsEditor block={block} courseId={courseId} onChange={onChange} renderContentEditor={(content, change) => <ContentBlockEditor block={content} courseId={courseId} onChange={change} inlineSettings />} />}
    {block.type === "hangingRopeCards" && <HangingRopeSettingsEditor block={block} courseId={courseId} onChange={onChange} renderContentEditor={(content, change) => <ContentBlockEditor block={content} courseId={courseId} onChange={change} inlineSettings />} />}
    {block.type === "audioInstruction" && <AudioInstructionSettings block={block} courseId={courseId} onChange={onChange} />}
    {block.type === "interactionButton" && <InteractionButtonSettings block={block} courseId={courseId} lessonBlocks={lessonBlocks} sections={sections} lessons={lessons} onChange={onChange} />}
    {block.type === "knowledgeCheck" && <KnowledgeCheckBlockSettings block={block} onChange={onChange} />}
    {block.type === "survey" && <SurveyBlockSettings block={block} onChange={onChange} />}
    {!inlineSettings && hasProgressRequirement && <section className="space-y-2 border-t border-slate-200 pt-3" aria-label="Lesson completion settings">
      <h3 className="text-xs font-semibold text-slate-700">Lesson completion</h3>
      <BlockProgressControls block={block} lessonBlocks={lessonBlocks} onChange={onChange} />
    </section>}
  </>;

  return (
    <div className="group relative">
      {!inlineSettings && settingsButton()}
      {(!inlineSettings || (block.type !== "flipCard" && block.type !== "accordion" && block.type !== "processSteps")) && <div className="block w-full rounded-md text-left">{preview}</div>}
      {inlineSettings && <div className="mt-3 space-y-3">{settingsContent}</div>}
      {!inlineSettings && editing && (
        <DraggableSettingsPanel
          id={settingsPanelId}
          title="Content settings"
          side="left"
          anchorRef={settingsButtonRef}
          panelClassName="w-[min(380px,calc(100vw-3rem))]"
        >
          {settingsContent}
        </DraggableSettingsPanel>
      )}
      <MediaLibraryDialog
        courseId={courseId}
        kind={mediaLibraryTarget === "audio" ? "audio" : mediaLibraryTarget === "attachment" ? "attachment" : mediaLibraryTarget === "video" ? "video" : "image"}
        open={mediaLibraryTarget !== null}
        onClose={() => {
          setMediaLibraryTarget(null);
          setSelectedGalleryImageIndex(null);
        }}
        onSelect={selectMedia}
      />
    </div>
  );
}
