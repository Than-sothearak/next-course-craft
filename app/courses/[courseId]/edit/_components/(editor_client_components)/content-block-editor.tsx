"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { LayoutGrid, LockKeyhole, Play, Plus, Settings2, Trash2 } from "lucide-react";
import type { ContentBlock } from "@/lib/schemas/block";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { CourseLinkBlock } from "@/components/course-link-block";
import { isSafeLinkHref, normalizeLinkHref } from "@/lib/editor/link-utils";
import { HeadingBlockEditor } from "./(content_block_editor_components)/heading-block-editor";
import { RichTextBlockEditor } from "./(content_block_editor_components)/rich-text-block-editor";
import { InputBlockPreview } from "./input-block-preview";
import { StatementContentEditor } from "./(content_block_editor_components)/statement-content-editor";
import { ProcessStepsSettings } from "./(content_block_editor_components)/process-steps-settings";
import { InteractiveAccordion, InteractiveFlipCard, InteractiveLabeledGraphic, InteractiveProcessSteps } from "../../../preview/interactive-blocks";
import { ImageBlockLayout } from "../image-block-layout";
import { ChartBlockPreview } from "../../../preview/chart-block";
import { LessonMapEditor } from "@/components/lesson-map";
import { DraggableSettingsPanel } from "./draggable-settings-panel";
import {
  MediaLibraryDialog,
  type MediaLibraryAsset,
} from "../media-library-dialog";

type FlipCard = Extract<ContentBlock, { type: "flipCard" }>['data']['cards'][number];
type FlipCardSide = "front" | "back";
type FlipCardFace = FlipCard[FlipCardSide];
type MediaLibraryTarget =
  | "image"
  | "gallery"
  | "video"
  | "labeledGraphic"
  | { type: "flipCard"; cardId: string; side: FlipCardSide };

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
}) {
  const [editing, setEditing] = useState(false);
  const [chartColorDraft, setChartColorDraft] = useState(
    block.type === "chart" ? block.data.color : "#4f46e5",
  );
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
    if (block.type === "gallery" && selectedGalleryImageIndex !== null) {
      onChange({
        ...block,
        data: {
          images: block.data.images.map((image, index) =>
            index === selectedGalleryImageIndex
              ? { ...image, src: asset.fileUrl }
              : image,
          ),
        },
      });
    }
    if (block.type === "labeledGraphic" && mediaLibraryTarget === "labeledGraphic") {
      onChange({ ...block, data: { ...block.data, src: asset.fileUrl } });
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
        {settingsButton()}
        {styleSettingsPanel()}
        <HeadingBlockEditor block={block} onChange={onChange} />
      </div>
    );
  if (block.type === "richText")
    return (
      <div className="group relative">
        {settingsButton()}
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
        {settingsButton()}
        {styleSettingsPanel()}
        <StatementContentEditor block={block} onChange={onChange} />
      </div>
    );
  if (block.type === "lessonMap")
    return (
      <LessonMapEditor
        block={block}
        sections={sections}
        lessons={lessons}
        saveState={saveState}
        hasUnsavedChanges={hasUnsavedChanges}
        saveMessage={saveMessage}
        onRetrySave={onRetrySave}
        onChange={(next) => onChange(next)}
      />
    );

  const preview =
    block.type === "link" ? (
      <CourseLinkBlock data={block.data} interactive={false} />
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
            borderTopColor: block.data.lineColor ?? "#cbd5e1",
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
        markers={block.data.markers}
        markerColor={block.data.markerColor ?? block.data.markers[0]?.color ?? "#2f5f9f"}
        textColor={block.data.textColor ?? "#ffffff"}
        radarColor={block.data.radarColor ?? block.data.markerColor ?? block.data.markers[0]?.color ?? "#2f5f9f"}
        interactionMode={block.data.interactionMode}
        sceneTheme={block.data.sceneTheme}
        challengePrompt={block.data.challengePrompt}
        successMessage={block.data.successMessage}
        editable
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

  return (
    <div className="group relative">
      {settingsButton()}
      <div className="block w-full rounded-md text-left">{preview}</div>
      {editing && (
        <DraggableSettingsPanel
          id={settingsPanelId}
          title="Content settings"
          side="left"
          anchorRef={settingsButtonRef}
          panelClassName="w-[min(380px,calc(100vw-3rem))]"
        >
          {replaceTemplateAction()}
          {block.type === "link" && (
            <div className="space-y-2">
              <Input
                aria-label="Link text"
                value={block.data.label}
                maxLength={200}
                onChange={(event) => onChange({
                  ...block,
                  data: { ...block.data, label: event.target.value },
                })}
                placeholder="Link text"
                className="h-9"
              />
              <div>
                <Input
                  aria-label="Link URL"
                  type="text"
                  value={block.data.url}
                  maxLength={2048}
                  onChange={(event) => onChange({
                    ...block,
                    data: { ...block.data, url: event.target.value },
                  })}
                  onBlur={(event) => {
                    const url = normalizeLinkHref(event.target.value);
                    if (url) onChange({ ...block, data: { ...block.data, url } });
                  }}
                  placeholder="https://example.com"
                  className="h-9"
                />
                {!isSafeLinkHref(block.data.url) && (
                  <p className="mt-1 text-xs text-rose-600">Enter a safe web, email, phone, or relative link.</p>
                )}
              </div>
              <Textarea
                aria-label="Link description"
                value={block.data.description}
                maxLength={1000}
                onChange={(event) => onChange({
                  ...block,
                  data: { ...block.data, description: event.target.value },
                })}
                placeholder="Short description (optional)"
                className="min-h-16 resize-y"
              />
              <Select
                aria-label="Link style"
                value={block.data.style}
                onChange={(event) => onChange({
                  ...block,
                  data: { ...block.data, style: event.target.value as typeof block.data.style },
                })}
                className="h-9 w-full"
              >
                <option value="button">Button</option>
                <option value="card">Resource card</option>
                <option value="text">Inline text</option>
              </Select>
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <Checkbox
                  checked={block.data.openInNewTab}
                  onChange={(event) => onChange({
                    ...block,
                    data: { ...block.data, openInNewTab: event.target.checked },
                  })}
                />
                Open in a new tab
              </label>
            </div>
          )}
          {block.type === "chart" && (
            <div className="space-y-3">
              <Input
                aria-label="Chart title"
                value={block.data.title}
                maxLength={500}
                onChange={(event) => onChange({
                  ...block,
                  data: { ...block.data, title: event.target.value },
                })}
                placeholder="Chart title"
                className="h-9"
              />
              <Textarea
                aria-label="Chart description"
                value={block.data.description}
                maxLength={2000}
                onChange={(event) => onChange({
                  ...block,
                  data: { ...block.data, description: event.target.value },
                })}
                placeholder="Description (optional)"
                className="min-h-16 resize-y"
              />
              <Select
                aria-label="Chart type"
                value={block.data.chartType}
                onChange={(event) => onChange({
                  ...block,
                  data: {
                    ...block.data,
                    chartType: event.target.value as typeof block.data.chartType,
                  },
                })}
                className="h-9 w-full"
              >
                <option value="bar">Horizontal bars</option>
                <option value="column">Columns</option>
                <option value="line">Line</option>
                <option value="donut">Donut</option>
                <option value="stacked">Stacked</option>
              </Select>
              <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
                <Input
                  aria-label="Chart color picker"
                  type="color"
                  value={block.data.color}
                  onChange={(event) => {
                    setChartColorDraft(event.target.value);
                    onChange({ ...block, data: { ...block.data, color: event.target.value } });
                  }}
                  className="h-9 w-12 cursor-pointer p-1"
                />
                <Input
                  aria-label="Chart color hex code"
                  value={chartColorDraft}
                  maxLength={7}
                  onChange={(event) => {
                    const value = event.target.value;
                    setChartColorDraft(value);
                    if (/^#[\da-fA-F]{6}$/.test(value)) {
                      onChange({ ...block, data: { ...block.data, color: value } });
                    }
                  }}
                  onBlur={() => setChartColorDraft(block.data.color)}
                  placeholder="#4f46e5"
                  className="h-9 font-mono"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs font-medium text-slate-500">
                  <span>Chart data</span>
                  <span>{block.data.fields.length}/20</span>
                </div>
                {block.data.fields.map((field, index) => (
                  <div key={field.id} className="flex items-center gap-2">
                    <Input
                      aria-label={`Chart field ${index + 1} label`}
                      value={field.label}
                      maxLength={120}
                      onChange={(event) => onChange({
                        ...block,
                        data: {
                          ...block.data,
                          fields: block.data.fields.map((item) => item.id === field.id
                            ? { ...item, label: event.target.value }
                            : item),
                        },
                      })}
                      placeholder="Label"
                      className="h-9 min-w-0 flex-1"
                    />
                    <Input
                      aria-label={`Chart field ${index + 1} value`}
                      type="number"
                      min="0"
                      max="1000000000000"
                      step="any"
                      value={field.value}
                      onChange={(event) => onChange({
                        ...block,
                        data: {
                          ...block.data,
                          fields: block.data.fields.map((item) => item.id === field.id
                            ? { ...item, value: Math.max(0, Number(event.target.value) || 0) }
                            : item),
                        },
                      })}
                      className="h-9 w-24 shrink-0"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove chart field ${index + 1}`}
                      disabled={block.data.fields.length <= 1}
                      onClick={() => onChange({
                        ...block,
                        data: { ...block.data, fields: block.data.fields.filter((item) => item.id !== field.id) },
                      })}
                      className="size-8 shrink-0 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={block.data.fields.length >= 20}
                  onClick={() => onChange({
                    ...block,
                    data: {
                      ...block.data,
                      fields: [...block.data.fields, {
                        id: crypto.randomUUID(),
                        label: `Field ${block.data.fields.length + 1}`,
                        value: 0,
                      }],
                    },
                  })}
                  className="w-full justify-center"
                >
                  <Plus size={14} /> Add data field
                </Button>
              </div>
            </div>
          )}
          {block.type === "image" && (
            <div className="space-y-2">
              <Select
                aria-label="Image layout"
                value={block.data.layout ?? "full"}
                onChange={(event) => {
                  const layout = event.target.value as NonNullable<
                    typeof block.data.layout
                  >;
                  const layoutWidth =
                    layout === "banner" || layout === "text-overlay"
                      ? "full"
                      : layout === "text-left" ||
                          layout === "text-right" ||
                          layout === "card"
                        ? "medium"
                        : "small";
                  onChange({
                    ...block,
                    width: block.widthCustom ? block.width : layoutWidth,
                    data: { ...block.data, layout },
                  });
                }}
                className="h-9 w-full"
              >
                <option value="full">Image with caption</option>
                <option value="banner">Wide image banner</option>
                <option value="text-left">Text left, image right</option>
                <option value="text-right">Image left, text right</option>
                <option value="text-overlay">Text overlay</option>
                <option value="card">Image feature card</option>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setMediaLibraryTarget("image")}
              >
                Choose from media library
              </Button>
              <Input
                aria-label="Image URL"
                type="url"
                value={block.data.src}
                onChange={(event) =>
                  onChange({
                    ...block,
                    data: { ...block.data, src: event.target.value },
                  })
                }
                placeholder="Image URL"
                className="h-9"
              />
              <Input
                aria-label="Alternative text"
                value={block.data.alt}
                maxLength={500}
                onChange={(event) =>
                  onChange({
                    ...block,
                    data: { ...block.data, alt: event.target.value },
                  })
                }
                placeholder="Alternative text"
                className="h-9"
              />
              <Input
                aria-label="Caption"
                value={block.data.caption ?? ""}
                maxLength={1000}
                onChange={(event) =>
                  onChange({
                    ...block,
                    data: { ...block.data, caption: event.target.value },
                  })
                }
                placeholder="Caption (optional)"
                className="h-9"
              />
            </div>
          )}
          {block.type === "gallery" && (
            <div className="space-y-3">
              {block.data.images.map((image, index) => (
                <div
                  key={`${block.id}-image-settings-${index}`}
                  className="flex items-start gap-2 rounded-lg border border-slate-100 p-2"
                >
                  <div className="min-w-0 flex-1 space-y-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedGalleryImageIndex(index);
                        setMediaLibraryTarget("gallery");
                      }}
                    >
                      Choose from media library
                    </Button>
                    <Input
                      aria-label={`Gallery image ${index + 1} URL`}
                      type="url"
                      value={image.src}
                      onChange={(event) =>
                        onChange({
                          ...block,
                          data: {
                            images: block.data.images.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, src: event.target.value }
                                : item,
                            ),
                          },
                        })
                      }
                      placeholder="Image URL"
                      className="h-9"
                    />
                    <Input
                      aria-label={`Gallery image ${index + 1} alternative text`}
                      value={image.alt}
                      maxLength={500}
                      onChange={(event) =>
                        onChange({
                          ...block,
                          data: {
                            images: block.data.images.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, alt: event.target.value }
                                : item,
                            ),
                          },
                        })
                      }
                      placeholder="Alternative text"
                      className="h-9"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove gallery image ${index + 1}`}
                    disabled={block.data.images.length <= 1}
                    onClick={() =>
                      onChange({
                        ...block,
                        data: {
                          images: block.data.images.filter(
                            (_, itemIndex) => itemIndex !== index,
                          ),
                        },
                      })
                    }
                    className="size-8 text-slate-400 hover:text-rose-700"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={block.data.images.length >= 8}
                onClick={() =>
                  onChange({
                    ...block,
                    data: {
                      images: [
                        ...block.data.images,
                        {
                          src: "https://placehold.co/480x360?text=Add+image",
                          alt: "",
                        },
                      ],
                    },
                  })
                }
              >
                <Plus size={14} />
                Add image
              </Button>
            </div>
          )}
          {block.type === "video" && (
            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setMediaLibraryTarget("video")}
              >
                Choose from media library
              </Button>
              <Input
                aria-label="Video URL"
                type="url"
                value={block.data.src}
                onChange={(event) => {
                  const data = { ...block.data, src: event.target.value };
                  delete data.mimeType;
                  onChange({ ...block, data });
                }}
                placeholder="Video URL"
                className="h-9"
              />
              <Input
                aria-label="Captions URL (optional)"
                type="url"
                value={block.data.captions ?? ""}
                onChange={(event) =>
                  onChange({
                    ...block,
                    data: { ...block.data, captions: event.target.value },
                  })
                }
                placeholder="Captions URL (optional)"
                className="h-9"
              />
            </div>
          )}
          {block.type === "divider" && (
            <div className="space-y-2">
              <Select
                aria-label="Divider style"
                value={block.data.style}
                onChange={(event) =>
                  onChange({
                    ...block,
                    data: {
                      ...block.data,
                      style: event.target.value as
                        | "line"
                        | "space"
                        | "continue",
                    },
                  })
                }
                className="h-9 w-full"
              >
                <option value="line">Line</option>
                <option value="space">Space</option>
                <option value="continue">Continue button</option>
              </Select>
              {block.data.style === "line" && (
                <>
                  <label className="block text-xs font-medium text-slate-600">
                    Line weight
                    <Select
                      aria-label="Divider line weight"
                      value={String(block.data.lineWeight ?? 1)}
                      onChange={(event) =>
                        onChange({
                          ...block,
                          data: {
                            ...block.data,
                            lineWeight: Number(event.target.value),
                          },
                        })
                      }
                      className="mt-1 h-9 w-full"
                    >
                      {[1, 2, 3, 4, 6, 8, 12, 16].map((weight) => (
                        <option key={weight} value={weight}>
                          {weight} px
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label className="block text-xs font-medium text-slate-600">
                    Line color
                    <input
                      type="color"
                      aria-label="Divider line color"
                      value={block.data.lineColor ?? "#cbd5e1"}
                      onChange={(event) =>
                        onChange({
                          ...block,
                          data: { ...block.data, lineColor: event.target.value },
                        })
                      }
                      className="mt-1 h-9 w-full cursor-pointer rounded-md border border-slate-200 bg-white p-1"
                    />
                  </label>
                  <label className="block text-xs font-medium text-slate-600">
                    Line style
                    <Select
                      aria-label="Divider line style"
                      value={block.data.lineStyle ?? "solid"}
                      onChange={(event) =>
                        onChange({
                          ...block,
                          data: {
                            ...block.data,
                            lineStyle: event.target.value as
                              | "solid"
                              | "dashed"
                              | "dotted"
                              | "double",
                          },
                        })
                      }
                      className="mt-1 h-9 w-full"
                    >
                      <option value="solid">Solid</option>
                      <option value="dashed">Dashed</option>
                      <option value="dotted">Dotted</option>
                      <option value="double">Double</option>
                    </Select>
                  </label>
                </>
              )}
              {block.data.style === "continue" && (
                <>
                  <Input
                    aria-label="Continue button label"
                    value={block.data.label}
                    maxLength={100}
                    onChange={(event) =>
                      onChange({
                        ...block,
                        data: { ...block.data, label: event.target.value },
                      })
                    }
                    placeholder="Continue"
                    className="h-9"
                  />
                  <Select
                    aria-label="Continue button completion type"
                    value={block.data.completionType}
                    onChange={(event) =>
                      onChange({
                        ...block,
                        data: {
                          ...block.data,
                          completionType: event.target.value as
                            | "none"
                            | "completeAbove",
                        },
                      })
                    }
                    className="h-9 w-full"
                  >
                    <option value="none">No completion lock</option>
                    <option value="completeAbove">
                      Complete content above to unlock
                    </option>
                  </Select>
                </>
              )}
            </div>
          )}
          {block.type === "flipCard" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1 text-xs font-medium text-slate-600">
                  <span>Cards per row</span>
                  <Select
                    aria-label="Cards per row"
                    value={String(block.data.cardsPerRow)}
                    onChange={(event) => onChange({
                      ...block,
                      data: { ...block.data, cardsPerRow: Number(event.target.value) as 1 | 2 | 3 | 4 | 5 },
                    })}
                    className="h-9"
                  >
                    {[1, 2, 3, 4, 5].map((count) => <option key={count} value={count}>{count}</option>)}
                  </Select>
                </label>
                <label className="space-y-1 text-xs font-medium text-slate-600">
                  <span>Card style</span>
                  <Select
                    aria-label="Card style"
                    value={block.data.cardStyle}
                    onChange={(event) => onChange({
                      ...block,
                      data: { ...block.data, cardStyle: event.target.value as typeof block.data.cardStyle },
                    })}
                    className="h-9"
                  >
                    <option value="classic">Classic</option>
                    <option value="soft">Soft</option>
                    <option value="outlined">Outlined</option>
                    <option value="elevated">Elevated</option>
                  </Select>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1 text-xs font-medium text-slate-600">
                  <span>Card background</span>
                  <Input
                    aria-label="Card background color"
                    type="color"
                    value={block.data.cardBackgroundColor}
                    onChange={(event) => onChange({
                      ...block,
                      data: { ...block.data, cardBackgroundColor: event.target.value },
                    })}
                    className="h-9 cursor-pointer p-1"
                  />
                </label>
                <label className="space-y-1 text-xs font-medium text-slate-600">
                  <span>Card text</span>
                  <Input
                    aria-label="Card text color"
                    type="color"
                    value={block.data.cardTextColor}
                    onChange={(event) => onChange({
                      ...block,
                      data: { ...block.data, cardTextColor: event.target.value },
                    })}
                    className="h-9 cursor-pointer p-1"
                  />
                </label>
              </div>
              {block.data.cards.map((card, index) => (
                <details key={card.id} open={index === 0} className="group/card relative rounded-lg border border-slate-200">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 pr-12 text-sm font-medium text-slate-700">
                    <span>Card {index + 1}</span>
                    <span aria-hidden="true" className="text-slate-400 transition-transform group-open/card:rotate-180">⌄</span>
                  </summary>
                  {block.data.cards.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete flip card ${index + 1}`}
                      onClick={() => onChange({
                        ...block,
                        data: { ...block.data, cards: block.data.cards.filter((item) => item.id !== card.id) },
                      })}
                      className="absolute right-1 top-1 size-8 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                    >
                      <Trash2 size={14} />
                    </Button>
                  )}
                  <div className="space-y-3 border-t border-slate-100 p-3">
                    {(["front", "back"] as const).map((side) => {
                      const face = card[side];
                      const faceLabel = side === "front" ? "front" : "back";
                      return (
                        <div key={side} className="space-y-2 rounded-lg bg-slate-50 p-3">
                          <Input
                            aria-label={`Card ${index + 1} ${faceLabel} label`}
                            value={side === "front" ? card.frontLabel : card.backLabel}
                            maxLength={80}
                            onChange={(event) => updateFlipCard(card.id, (current) => ({
                              ...current,
                              [side === "front" ? "frontLabel" : "backLabel"]: event.target.value,
                            }))}
                            placeholder={`${faceLabel} label`}
                            className="h-9"
                          />
                          <Select
                            aria-label={`Card ${index + 1} ${faceLabel} content type`}
                            value={face.type}
                            onChange={(event) => {
                              const type = event.target.value as "text" | "image";
                              if (type === "text") {
                                updateFlipCardFace(card.id, side, face.type === "text" ? face : { type: "text", text: "" });
                              } else {
                                updateFlipCardFace(card.id, side, face.type === "image" ? face : { type: "image", src: "https://placehold.co/800x520?text=Add+an+image", alt: "" });
                              }
                            }}
                            className="h-9 w-full"
                          >
                            <option value="text">Text</option>
                            <option value="image">Image</option>
                          </Select>
                          {face.type === "text" ? (
                            <Textarea
                              aria-label={`Card ${index + 1} ${faceLabel} text`}
                              value={face.text}
                              maxLength={2000}
                              onChange={(event) => updateFlipCardFace(card.id, side, { ...face, text: event.target.value })}
                              placeholder={side === "front" ? "Prompt or question" : "Answer or explanation"}
                              className="min-h-20 resize-y"
                            />
                          ) : (
                            <div className="space-y-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setMediaLibraryTarget({ type: "flipCard", cardId: card.id, side })}
                              >
                                Choose from media library
                              </Button>
                              <Input
                                aria-label={`Card ${index + 1} ${faceLabel} image URL`}
                                type="url"
                                value={face.src}
                                onChange={(event) => updateFlipCardFace(card.id, side, { ...face, src: event.target.value })}
                                placeholder="Image URL"
                                className="h-9"
                              />
                              <Input
                                aria-label={`Card ${index + 1} ${faceLabel} image alternative text`}
                                value={face.alt}
                                maxLength={500}
                                onChange={(event) => updateFlipCardFace(card.id, side, { ...face, alt: event.target.value })}
                                placeholder="Alternative text"
                                className="h-9"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </details>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={block.data.cards.length >= 30}
                onClick={() => onChange({
                  ...block,
                  data: {
                    ...block.data,
                    cards: [...block.data.cards, {
                      id: `card-${crypto.randomUUID()}`,
                      frontLabel: "Question",
                      front: { type: "text", text: "" },
                      backLabel: "Answer",
                      back: { type: "text", text: "" },
                    }],
                  },
                })}
                className="w-full justify-center"
              >
                <Plus size={14} /> Add card
              </Button>
            </div>
          )}
          {block.type === "accordion" && (
            <div className="space-y-3">
              <Select
                aria-label="Reveal layout"
                value={block.data.layout}
                onChange={(event) => onChange({
                  ...block,
                  data: { ...block.data, layout: event.target.value as "accordion" | "tabs" },
                })}
              >
                <option value="accordion">Accordion</option>
                <option value="tabs">Tabs</option>
              </Select>
              {block.data.layout === "accordion" && (
                <Select
                  aria-label="Explanation display"
                  value={block.data.displayMode}
                  onChange={(event) => onChange({
                    ...block,
                    data: {
                      ...block.data,
                      displayMode: event.target.value as "all" | "oneByOne",
                    },
                  })}
                >
                  <option value="all">Show all (keep others open)</option>
                  <option value="oneByOne">Show one by one</option>
                </Select>
              )}
              {block.data.items.map((item, index) => (
                <div key={item.id} className="space-y-2 rounded-lg border border-slate-200 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-500">Section {index + 1}</span>
                    {block.data.items.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete reveal section ${index + 1}`}
                        onClick={() => onChange({
                          ...block,
                          data: { ...block.data, items: block.data.items.filter((entry) => entry.id !== item.id) },
                        })}
                        className="size-8 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                  <Input
                    aria-label={`Reveal section ${index + 1} title`}
                    value={item.title}
                    maxLength={160}
                    onChange={(event) => onChange({
                      ...block,
                      data: { ...block.data, items: block.data.items.map((entry) => entry.id === item.id ? { ...entry, title: event.target.value } : entry) },
                    })}
                    placeholder="Section title"
                    className="h-9"
                  />
                  <Textarea
                    aria-label={`Reveal section ${index + 1} explanation`}
                    value={item.body}
                    maxLength={5000}
                    onChange={(event) => onChange({
                      ...block,
                      data: { ...block.data, items: block.data.items.map((entry) => entry.id === item.id ? { ...entry, body: event.target.value } : entry) },
                    })}
                    placeholder="Explanation"
                    className="min-h-16 resize-y"
                  />
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={block.data.items.length >= 12}
                onClick={() => onChange({
                  ...block,
                  data: { ...block.data, items: [...block.data.items, { id: crypto.randomUUID(), title: "New section", body: "" }] },
                })}
                className="w-full justify-center"
              >
                <Plus size={14} /> Add section
              </Button>
            </div>
          )}
          {block.type === "labeledGraphic" && (
            <div className="space-y-3">
              <Select
                aria-label="Graphic interaction mode"
                value={block.data.interactionMode ?? "explore"}
                onChange={(event) => {
                  const interactionMode = event.target.value as "explore" | "spotTarget";
                  const markers = interactionMode === "spotTarget"
                    ? block.data.markers.map((marker, index) => ({
                        ...marker,
                        isTarget: block.data.markers.some((entry) => entry.isTarget)
                          ? Boolean(marker.isTarget)
                          : index === 0,
                      }))
                    : block.data.markers;
                  onChange({
                    ...block,
                    data: {
                      ...block.data,
                      interactionMode,
                      ...(interactionMode === "spotTarget" ? {
                        sceneTheme: block.data.sceneTheme ?? "data",
                        challengePrompt: block.data.challengePrompt ?? "Find the clue in the scene.",
                        successMessage: block.data.successMessage ?? "Clue found! Great work scanning the scene.",
                      } : {}),
                      markers,
                    },
                  });
                }}
                className="h-9 w-full"
              >
                <option value="explore">Explore hotspots</option>
                <option value="spotTarget">Spot the clue mini-game</option>
              </Select>
              {block.data.interactionMode === "spotTarget" ? (
                <>
                  <Select
                    aria-label="Mini-game scene"
                    value={block.data.sceneTheme ?? "data"}
                    onChange={(event) => onChange({
                      ...block,
                      data: { ...block.data, sceneTheme: event.target.value as NonNullable<typeof block.data.sceneTheme> },
                    })}
                    className="h-9 w-full"
                  >
                    <option value="data">Data dashboard</option>
                    <option value="security">Security inbox</option>
                    <option value="network">Network map</option>
                    <option value="agriculture">Crop field</option>
                  </Select>
                  <Textarea
                    aria-label="Mini-game challenge"
                    value={block.data.challengePrompt ?? ""}
                    maxLength={300}
                    onChange={(event) => onChange({
                      ...block,
                      data: { ...block.data, challengePrompt: event.target.value },
                    })}
                    placeholder="What should learners find?"
                    className="min-h-16 resize-y"
                  />
                  <Textarea
                    aria-label="Mini-game success message"
                    value={block.data.successMessage ?? ""}
                    maxLength={500}
                    onChange={(event) => onChange({
                      ...block,
                      data: { ...block.data, successMessage: event.target.value },
                    })}
                    placeholder="What should learners learn after finding it?"
                    className="min-h-16 resize-y"
                  />
                  <p className="text-xs text-slate-500">Choose exactly one winning hotspot. Drag the points on the graphic to line them up with scene details.</p>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setMediaLibraryTarget("labeledGraphic")}
                  >
                    Choose graphic from media library
                  </Button>
                  <Input
                    aria-label="Graphic image URL"
                    type="url"
                    value={block.data.src}
                    onChange={(event) => onChange({ ...block, data: { ...block.data, src: event.target.value } })}
                    placeholder="Image URL"
                    className="h-9"
                  />
                </>
              )}
              <Input
                aria-label="Graphic alternative text"
                value={block.data.alt}
                maxLength={500}
                onChange={(event) => onChange({ ...block, data: { ...block.data, alt: event.target.value } })}
                placeholder="Describe the image or game scene"
                className="h-9"
              />
              {block.data.interactionMode !== "spotTarget" && (
                <p className="text-xs text-slate-500">
                  Drag a point on the image to position it. Click a point to preview its popup.
                </p>
              )}
              <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-3">
                <label className="flex items-center justify-between gap-2 text-xs font-medium text-slate-600">
                  Point color
                  <Input
                    aria-label="Graphic marker color"
                    type="color"
                    value={block.data.markerColor ?? block.data.markers[0]?.color ?? "#2f5f9f"}
                    onChange={(event) => onChange({
                      ...block,
                      data: { ...block.data, markerColor: event.target.value },
                    })}
                    className="h-9 w-12 cursor-pointer p-1"
                  />
                </label>
                <label className="flex items-center justify-between gap-2 text-xs font-medium text-slate-600">
                  Number text
                  <Input
                    aria-label="Graphic marker text color"
                    type="color"
                    value={block.data.textColor ?? "#ffffff"}
                    onChange={(event) => onChange({
                      ...block,
                      data: { ...block.data, textColor: event.target.value },
                    })}
                    className="h-9 w-12 cursor-pointer p-1"
                  />
                </label>
                <label className="flex items-center justify-between gap-2 text-xs font-medium text-slate-600">
                  Radar pulse
                  <Input
                    aria-label="Graphic marker radar color"
                    type="color"
                    value={block.data.radarColor ?? block.data.markerColor ?? block.data.markers[0]?.color ?? "#2f5f9f"}
                    onChange={(event) => onChange({
                      ...block,
                      data: { ...block.data, radarColor: event.target.value },
                    })}
                    className="h-9 w-12 cursor-pointer p-1"
                  />
                </label>
              </div>
              {block.data.markers.map((marker, index) => (
                <div key={marker.id} className="space-y-2 rounded-lg border border-slate-200 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-500">Marker {index + 1}</span>
                    {block.data.markers.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete graphic marker ${index + 1}`}
                        onClick={() => onChange({
                          ...block,
                          data: { ...block.data, markers: block.data.markers.filter((entry) => entry.id !== marker.id) },
                        })}
                        className="size-8 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                  <Input
                    aria-label={`Graphic marker ${index + 1} label`}
                    value={marker.label}
                    maxLength={100}
                    onChange={(event) => onChange({
                      ...block,
                      data: { ...block.data, markers: block.data.markers.map((entry) => entry.id === marker.id ? { ...entry, label: event.target.value } : entry) },
                    })}
                    placeholder="Marker label"
                    className="h-9"
                  />
                  <Textarea
                    aria-label={`Graphic marker ${index + 1} explanation`}
                    value={marker.description}
                    maxLength={2000}
                    onChange={(event) => onChange({
                      ...block,
                      data: { ...block.data, markers: block.data.markers.map((entry) => entry.id === marker.id ? { ...entry, description: event.target.value } : entry) },
                    })}
                    placeholder="What should learners know about this part?"
                    className="min-h-16 resize-y"
                  />
                  {block.data.interactionMode === "spotTarget" && (
                    <>
                      <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                        <Checkbox
                          aria-label={`Mark hotspot ${index + 1} as the correct target`}
                          checked={Boolean(marker.isTarget)}
                          onChange={(event) => onChange({
                            ...block,
                            data: {
                              ...block.data,
                              markers: block.data.markers.map((entry) => ({
                                ...entry,
                                isTarget: event.target.checked ? entry.id === marker.id : entry.id === marker.id ? false : entry.isTarget,
                              })),
                            },
                          })}
                        />
                        Correct target
                      </label>
                      <Textarea
                        aria-label={`Graphic marker ${index + 1} retry hint`}
                        value={marker.missFeedback ?? ""}
                        maxLength={500}
                        onChange={(event) => onChange({
                          ...block,
                          data: { ...block.data, markers: block.data.markers.map((entry) => entry.id === marker.id ? { ...entry, missFeedback: event.target.value } : entry) },
                        })}
                        placeholder="Hint shown when this point is missed"
                        className="min-h-14 resize-y"
                      />
                    </>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={block.data.markers.length >= 20}
                onClick={() => onChange({
                  ...block,
                  data: { ...block.data, markers: [...block.data.markers, { id: crypto.randomUUID(), label: "New marker", description: "", x: 50, y: 50, ...(block.data.interactionMode === "spotTarget" ? { isTarget: false } : {}) }] },
                })}
                className="w-full justify-center"
              >
                <Plus size={14} /> Add marker
              </Button>
            </div>
          )}
          {block.type === "processSteps" && (
            <ProcessStepsSettings block={block} onChange={onChange} />
          )}
          {block.type === "knowledgeCheck" && (
            <div className="space-y-2">
              <Input
                aria-label="Question"
                value={block.data.question}
                maxLength={1000}
                onChange={(event) =>
                  onChange({
                    ...block,
                    data: { ...block.data, question: event.target.value },
                  })
                }
                placeholder="Question"
                className="h-9"
              />
              <p className="pt-1 text-xs font-medium text-slate-500">
                Select the correct answer
              </p>
              {block.data.options.map((option, index) => (
                <label key={index} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`correct-answer-${block.id}`}
                    aria-label={`Mark answer ${index + 1} as correct`}
                    checked={(block.data.correctOptionIndex ?? 0) === index}
                    onChange={() =>
                      onChange({
                        ...block,
                        data: { ...block.data, correctOptionIndex: index },
                      })
                    }
                    className="size-4 shrink-0 accent-indigo-600"
                  />
                  <Input
                    aria-label={`Answer option ${index + 1}`}
                    value={option}
                    maxLength={500}
                    onChange={(event) =>
                      onChange({
                        ...block,
                        data: {
                          ...block.data,
                          options: block.data.options.map((item, itemIndex) =>
                            itemIndex === index ? event.target.value : item,
                          ),
                        },
                      })
                    }
                    placeholder={`Answer option ${index + 1}`}
                    className="h-9"
                  />
                </label>
              ))}
              <Input
                aria-label="Correct answer feedback"
                value={block.data.correctFeedback ?? "Correct!"}
                maxLength={1000}
                onChange={(event) =>
                  onChange({
                    ...block,
                    data: {
                      ...block.data,
                      correctFeedback: event.target.value,
                    },
                  })
                }
                placeholder="Correct feedback"
                className="h-9"
              />
              <Input
                aria-label="Incorrect answer feedback"
                value={block.data.incorrectFeedback ?? "Not quite. Try again."}
                maxLength={1000}
                onChange={(event) =>
                  onChange({
                    ...block,
                    data: {
                      ...block.data,
                      incorrectFeedback: event.target.value,
                    },
                  })
                }
                placeholder="Try-again feedback"
                className="h-9"
              />
            </div>
          )}
          {block.type === "survey" && (
            <div className="space-y-2">
              <Input
                aria-label="Survey question"
                value={block.data.question}
                maxLength={1000}
                onChange={(event) =>
                  onChange({
                    ...block,
                    data: { ...block.data, question: event.target.value },
                  })
                }
                placeholder="Survey question"
                className="h-9"
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  aria-label="Lowest rating label"
                  value={block.data.minLabel}
                  maxLength={100}
                  onChange={(event) =>
                    onChange({
                      ...block,
                      data: { ...block.data, minLabel: event.target.value },
                    })
                  }
                  placeholder="Lowest label"
                  className="h-9"
                />
                <Input
                  aria-label="Highest rating label"
                  value={block.data.maxLabel}
                  maxLength={100}
                  onChange={(event) =>
                    onChange({
                      ...block,
                      data: { ...block.data, maxLabel: event.target.value },
                    })
                  }
                  placeholder="Highest label"
                  className="h-9"
                />
              </div>
            </div>
          )}
        </DraggableSettingsPanel>
      )}
      <MediaLibraryDialog
        courseId={courseId}
        kind={mediaLibraryTarget === "video" ? "video" : "image"}
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
