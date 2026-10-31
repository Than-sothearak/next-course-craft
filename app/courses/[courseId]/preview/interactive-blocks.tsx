"use client";

import { ColorPicker } from "@/components/ui/color-picker";

/* eslint-disable @next/next/no-img-element -- This component is also bundled into static course exports. */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { Check, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { LessonMapArtwork } from "@/components/lesson-map-artwork";
import { evaluateKnowledgeCheckAnswer } from "@/lib/interactive/knowledge-check";
import { getFlipCardProgressId } from "@/lib/export/progress";
import type { ContentBlock, LessonMapTemplate } from "@/lib/schemas/block";
import { InteractiveScene } from "@/components/interactive-scene";
import { fitGraphicImage, projectGraphicPoint, unprojectGraphicPoint, type GraphicImageFit } from "@/lib/editor/graphic-layout";
import { backgroundPaint, parseGradient, solidColor, textPaint } from "@/lib/color";

type FlipCard = Extract<ContentBlock, { type: "flipCard" }>['data']['cards'][number];
type FlipCardStyle = Extract<ContentBlock, { type: "flipCard" }>['data']['cardStyle'];
type AccordionItem = Extract<ContentBlock, { type: "accordion" }>['data']['items'][number];
type GraphicMarker = Extract<ContentBlock, { type: "labeledGraphic" }>['data']['markers'][number];
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

const flipCardStyleClasses: Record<FlipCardStyle, string> = {
  classic: "rounded-2xl",
  soft: "rounded-3xl",
  outlined: "rounded-xl",
  elevated: "rounded-2xl",
};

function flipCardColumnsClass(columns: number, presentation: boolean) {
  if (presentation) return [
    columns >= 2 ? "@min-[18rem]/flip-cards:grid-cols-2" : "",
    columns >= 3 ? "@min-[28rem]/flip-cards:grid-cols-3" : "",
    columns >= 4 ? "@min-[38rem]/flip-cards:grid-cols-4" : "",
    columns >= 5 ? "@min-[46rem]/flip-cards:grid-cols-5" : "",
  ].filter(Boolean).join(" ");
  return [
    columns >= 2 ? "@min-[36rem]/flip-cards:grid-cols-2" : "",
    columns >= 3 ? "@min-[56rem]/flip-cards:grid-cols-3" : "",
    columns >= 4 ? "@min-[60rem]/flip-cards:grid-cols-4" : "",
    columns >= 5 ? "@min-[64rem]/flip-cards:grid-cols-5" : "",
  ].filter(Boolean).join(" ");
}

function flipCardSurfaceStyle(cardStyle: FlipCardStyle, backgroundColor: string, textColor: string): CSSProperties {
  const solidText = solidColor(textColor);
  const borderColor = cardStyle === "outlined"
    ? solidText
    : cardStyle === "soft"
      ? "transparent"
      : `color-mix(in srgb, ${solidText} 18%, transparent)`;
  const boxShadow = cardStyle === "elevated"
    ? `0 10px 28px color-mix(in srgb, ${solidText} 18%, transparent)`
    : cardStyle === "classic"
      ? "0 1px 3px rgb(15 23 42 / 0.08)"
      : "none";

  return {
    ...backgroundPaint(backgroundColor),
    color: solidText,
    borderColor,
    borderWidth: cardStyle === "outlined" ? "2px" : "1px",
    boxShadow,
  };
}

export function InteractiveFlipCard({
  blockId,
  cards,
  cardsPerRow = 3,
  cardStyle = "classic",
  cardBackgroundColor = "#ffffff",
  cardTextColor = "#0f172a",
  interactedCardIds = new Set(),
  onCardReveal,
  presentation = false,
}: {
  blockId: string;
  cards: FlipCard[];
  cardsPerRow?: number;
  cardStyle?: FlipCardStyle;
  cardBackgroundColor?: string;
  cardTextColor?: string;
  interactedCardIds?: ReadonlySet<string>;
  onCardReveal?: (progressId: string) => void;
  presentation?: boolean;
}) {
  const visibleColumnCount = Math.min(cardsPerRow, cards.length);
  const gridColumns = flipCardColumnsClass(visibleColumnCount, presentation);

  return (
    <div className="@container/flip-cards mx-auto w-full min-w-0">
      <div className={cards.length > 1 ? `grid min-w-0 grid-cols-1 ${presentation ? "gap-2" : "gap-3 @min-[36rem]/flip-cards:gap-4"} ${gridColumns}` : "w-full min-w-0"}>
        {cards.map((card, index) => (
          <InteractiveFlipCardItem
            key={card.id}
            card={card}
            cardNumber={index + 1}
            presentation={presentation}
            cardStyle={cardStyle}
            cardBackgroundColor={cardBackgroundColor}
            cardTextColor={cardTextColor}
            initiallyRevealed={interactedCardIds.has(getFlipCardProgressId(blockId, card.id))}
            onReveal={() => onCardReveal?.(getFlipCardProgressId(blockId, card.id))}
          />
        ))}
      </div>
    </div>
  );
}

function FlipCardFace({ card, side, presentation, textColor }: { card: FlipCard; side: "front" | "back"; presentation: boolean; textColor: string }) {
  const label = side === "front" ? card.frontLabel : card.backLabel;
  const face = side === "front" ? card.front : card.back;
  return (
    <>
      <span style={textPaint(textColor)} className={`min-w-0 max-w-full whitespace-pre-wrap [overflow-wrap:anywhere] font-semibold uppercase tracking-[0.14em] opacity-65 ${presentation ? "mb-2 text-[10px]" : "mb-3 text-xs"}`}>{label || (side === "front" ? "Question" : "Answer")}</span>
      {face.type === "image" ? (
        <img src={face.src} alt={face.alt} className={`h-auto w-auto max-w-full rounded-lg object-contain ${presentation ? "max-h-28" : "max-h-56"}`} />
      ) : (
        <span style={textPaint(textColor)} className={`min-w-0 max-w-full whitespace-pre-wrap break-words [overflow-wrap:anywhere] ${presentation ? side === "front" ? "text-sm font-semibold @min-[30rem]/flip-cards:text-base" : "text-xs @min-[30rem]/flip-cards:text-sm" : side === "front" ? "text-lg font-semibold @min-[36rem]/flip-cards:text-xl" : "text-base @min-[36rem]/flip-cards:text-lg"}`}>
          {face.text || (side === "front" ? "Add a prompt for your learner." : "Add the answer or explanation here.")}
        </span>
      )}
      <span style={textPaint(textColor)} className={`font-medium opacity-70 ${presentation ? "mt-2 text-[10px]" : "mt-4 text-xs @min-[36rem]/flip-cards:mt-5"}`}>
        {side === "front" ? "Click to flip" : "Click to flip back"}
      </span>
    </>
  );
}

function InteractiveFlipCardItem({
  card,
  cardNumber,
  cardStyle,
  cardBackgroundColor,
  cardTextColor,
  initiallyRevealed,
  onReveal,
  presentation,
}: {
  card: FlipCard;
  cardNumber: number;
  cardStyle: FlipCardStyle;
  cardBackgroundColor: string;
  cardTextColor: string;
  initiallyRevealed: boolean;
  onReveal: () => void;
  presentation: boolean;
}) {
  const [flipOverride, setFlipOverride] = useState<boolean | null>(null);
  const flipped = flipOverride ?? initiallyRevealed;

  function flip() {
    const nextFlipped = !flipped;
    if (nextFlipped) onReveal();
    setFlipOverride(nextFlipped);
  }

  return (
    <button
      type="button"
      aria-label={flipped ? `Show the front of card ${cardNumber}` : `Flip card ${cardNumber} to reveal the back`}
      aria-pressed={flipped}
      onClick={flip}
      className={`cursor-pointer group w-full min-w-0 ${flipCardStyleClasses[cardStyle]} text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-4`}
      style={{ perspective: "1000px" }}
    >
      <span className={`grid w-full min-w-0 transition-transform duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none ${presentation ? "min-h-28" : "min-h-52"}`} style={{ transform: flipped ? "rotateY(180deg)" : undefined, transformStyle: "preserve-3d" }}>
        <span
          aria-hidden={flipped}
          className={`col-start-1 row-start-1 flex min-w-0 flex-col items-center justify-center border text-center transition-colors ${presentation ? "min-h-28 p-3" : "min-h-48 p-4 @min-[36rem]/flip-cards:min-h-52 @min-[36rem]/flip-cards:p-6"} ${flipCardStyleClasses[cardStyle]}`}
          style={{ ...flipCardSurfaceStyle(cardStyle, cardBackgroundColor, cardTextColor), backfaceVisibility: "hidden" }}
        >
          <FlipCardFace card={card} side="front" presentation={presentation} textColor={cardTextColor} />
        </span>
        <span
          aria-hidden={!flipped}
          className={`col-start-1 row-start-1 flex min-w-0 flex-col items-center justify-center border text-center ${presentation ? "min-h-28 p-3" : "min-h-48 p-4 @min-[36rem]/flip-cards:min-h-52 @min-[36rem]/flip-cards:p-6"} ${flipCardStyleClasses[cardStyle]}`}
          style={{ ...flipCardSurfaceStyle(cardStyle, cardBackgroundColor, cardTextColor), backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          <FlipCardFace card={card} side="back" presentation={presentation} textColor={cardTextColor} />
        </span>
      </span>
    </button>
  );
}

export function InteractiveKnowledgeCheck({
  blockId,
  question,
  options,
  correctOptionIndex,
  correctFeedback,
  incorrectFeedback,
  onAnswerChecked,
}: {
  blockId: string;
  question: string;
  options: string[];
  correctOptionIndex: number;
  correctFeedback: string;
  incorrectFeedback: string;
  onAnswerChecked?: () => void;
}) {
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const [result, setResult] = useState<ReturnType<typeof evaluateKnowledgeCheckAnswer>>(null);

  function submitAnswer() {
    setResult(evaluateKnowledgeCheckAnswer({
      selectedOptionIndex,
      correctOptionIndex,
      correctFeedback,
      incorrectFeedback,
    }));
    onAnswerChecked?.();
  }

  return (
    <fieldset className="space-y-4">
      <legend className="text-lg font-semibold">{question}</legend>
      <div className="space-y-2">
        {options.map((option, index) => (
          <label
            key={`${blockId}-${index}`}
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm transition-colors hover:border-slate-400"
            style={selectedOptionIndex === index ? { borderColor: "var(--course-primary, #2f5f9f)", backgroundColor: "color-mix(in srgb, var(--course-primary, #2f5f9f) 9%, white)" } : undefined}
          >
            <input
              type="radio"
              name={`knowledge-check-${blockId}`}
              value={index}
              checked={selectedOptionIndex === index}
              onChange={() => {
                setSelectedOptionIndex(index);
                setResult(null);
              }}
              className="mt-0.5"
              style={{ accentColor: "var(--course-primary, #2f5f9f)" }}
            />
            <span>{option || `Answer option ${index + 1}`}</span>
          </label>
        ))}
      </div>
      <Button type="button" disabled={selectedOptionIndex === null} onClick={submitAnswer} style={{ backgroundColor: "var(--course-primary, #2f5f9f)" }}>
        Check answer
      </Button>
      {result && (
        <p
          role="status"
          aria-live="polite"
          className={`rounded-lg px-4 py-3 text-sm font-medium ${result.correct ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}
        >
          {result.feedback}
        </p>
      )}
    </fieldset>
  );
}

export function InteractiveSurvey({
  blockId,
  question,
  minLabel,
  maxLabel,
  onSubmit,
}: {
  blockId: string;
  question: string;
  minLabel: string;
  maxLabel: string;
  onSubmit?: () => void;
}) {
  const [rating, setRating] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  return (
    <fieldset className="space-y-4">
      <legend className="text-lg font-semibold">{question}</legend>
      <div className="flex flex-wrap items-center gap-3">
        {[1, 2, 3, 4, 5].map((value) => (
          <label
            key={`${blockId}-${value}`}
            className="flex cursor-pointer flex-col items-center gap-1 text-sm"
          >
            <input
              type="radio"
              name={`survey-${blockId}`}
              value={value}
              checked={rating === value}
              onChange={() => {
                setRating(value);
                setSubmitted(false);
              }}
              className="size-5"
              style={{ accentColor: "var(--course-primary, #2f5f9f)" }}
            />
            <span>{value}</span>
          </label>
        ))}
      </div>
      <div className="flex max-w-sm justify-between text-xs text-slate-500">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
      <Button type="button" variant="outline" disabled={rating === null} onClick={() => { setSubmitted(true); onSubmit?.(); }}>
        {submitted ? "Done" : "Finish reflection"}
      </Button>
      {submitted && (
        <p role="status" aria-live="polite" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          Thanks for taking a moment to reflect.
        </p>
      )}
    </fieldset>
  );
}

export function InteractiveAccordion({
  blockId,
  layout,
  displayMode,
  items,
  onItemInteract,
}: {
  blockId: string;
  layout: "accordion" | "tabs";
  displayMode: "all" | "oneByOne";
  items: AccordionItem[];
  onItemInteract?: (itemId: string) => void;
}) {
  const [activeItemId, setActiveItemId] = useState(items[0]?.id ?? "");
  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(
    () => new Set(items[0] ? [items[0].id] : []),
  );
  const activeItem = items.find((item) => item.id === activeItemId) ?? items[0];

  if (layout === "tabs") {
    return (
      <div className="min-w-0">
        <div role="tablist" aria-label="Content sections" className="flex max-w-full gap-1 overflow-x-auto border-b border-slate-200">
          {items.map((item) => {
            const selected = item.id === activeItem?.id;
            return (
              <button
                key={item.id}
                id={`${blockId}-tab-${item.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`${blockId}-panel-${item.id}`}
                onClick={() => { setActiveItemId(item.id); onItemInteract?.(item.id); }}
                className={`cursor-pointer shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors sm:px-4 ${selected ? "border-[var(--course-primary,#2f5f9f)] text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"}`}
              >
                {item.title || "Untitled tab"}
              </button>
            );
          })}
        </div>
        {activeItem && (
          <div
            id={`${blockId}-panel-${activeItem.id}`}
            role="tabpanel"
            aria-labelledby={`${blockId}-tab-${activeItem.id}`}
            className="rounded-b-xl border border-t-0 border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700 sm:p-5"
          >
            {activeItem.body || "Add an explanation for this section."}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const expanded = displayMode === "all"
          ? expandedItemIds.has(item.id)
          : item.id === activeItemId;
        return (
          <section key={item.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={`${blockId}-panel-${item.id}`}
              onClick={() => {
                if (displayMode === "all") {
                  setExpandedItemIds((current) => {
                    const next = new Set(current);
                    if (next.has(item.id)) next.delete(item.id);
                    else next.add(item.id);
                    return next;
                  });
                } else {
                  setActiveItemId(expanded ? "" : item.id);
                }
                onItemInteract?.(item.id);
              }}
              className="cursor-pointer flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50 sm:px-5"
            >
              <span>{item.title || "Untitled section"}</span>
              <span aria-hidden="true" className={`text-lg leading-none text-slate-400 transition-transform ${expanded ? "rotate-45" : ""}`}>+</span>
            </button>
            {expanded && (
              <div id={`${blockId}-panel-${item.id}`} className="border-t border-slate-100 px-4 py-3 text-sm leading-6 text-slate-700 sm:px-5">
                {item.body || "Add an explanation for this section."}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

export function InteractiveLabeledGraphic({
  blockId,
  src,
  alt,
  mapTemplate,
  objectFit = "fill",
  markers,
  markerColor,
  textColor = "#ffffff",
  radarColor,
  interactionMode,
  sceneTheme,
  challengePrompt,
  successMessage,
  editable = false,
  presentation = false,
  onMarkerPositionChange,
  onMarkerChange,
  onMarkerInteract,
}: {
  blockId: string;
  src: string;
  alt: string;
  mapTemplate?: LessonMapTemplate;
  objectFit?: GraphicImageFit;
  markers: GraphicMarker[];
  markerColor?: string;
  textColor?: string;
  radarColor?: string;
  interactionMode?: "explore" | "spotTarget";
  sceneTheme?: "data" | "security" | "network" | "agriculture";
  challengePrompt?: string;
  successMessage?: string;
  editable?: boolean;
  presentation?: boolean;
  onMarkerPositionChange?: (markerId: string, position: { x: number; y: number }) => void;
  onMarkerChange?: (markerId: string, update: Partial<Pick<GraphicMarker, "label" | "description" | "color" | "radarEnabled">>) => void;
  onMarkerInteract?: (markerId: string) => void;
}) {
  const [activeMarkerId, setActiveMarkerId] = useState("");
  const [gameSolved, setGameSolved] = useState(false);
  const [gameAttempts, setGameAttempts] = useState(0);
  const [lastMissedMarkerId, setLastMissedMarkerId] = useState("");
  const [missedMarkerIds, setMissedMarkerIds] = useState<string[]>([]);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const [imageSize, setImageSize] = useState<{ source: string; width: number; height: number } | null>(null);
  const popoverRef = useRef<HTMLElement>(null);
  const [popoverPosition, setPopoverPosition] = useState<{
    markerId: string;
    left: number;
    top: number;
  } | null>(null);
  const draggingPointerId = useRef<number | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const didDrag = useRef(false);
  const [dragPosition, setDragPosition] = useState<{ markerId: string; x: number; y: number } | null>(null);
  const dragPositionRef = useRef<typeof dragPosition>(null);
  const activeMarker = markers.find((marker) => marker.id === activeMarkerId) ?? markers[0];
  const showPopup = activeMarkerId !== "" && activeMarker?.id === activeMarkerId;
  const sharedMarkerColor = markerColor ?? "var(--course-primary, #2f5f9f)";
  const isSpotTargetGame = interactionMode === "spotTarget";
  const usesIllustratedScene = Boolean(sceneTheme && (!src || isSpotTargetGame));
  const usesMap = Boolean(mapTemplate && !isSpotTargetGame);
  const fitFrame = presentation && !isSpotTargetGame;
  const sourceWidth = usesMap ? 720 : usesIllustratedScene ? 1200 : imageSize?.source === src ? imageSize.width : frameSize.width;
  const sourceHeight = usesMap ? 440 : usesIllustratedScene ? 675 : imageSize?.source === src ? imageSize.height : frameSize.height;
  const imageRect = fitGraphicImage(frameSize, { width: sourceWidth, height: sourceHeight }, objectFit);
  const artworkStyle: CSSProperties = fitFrame && frameSize.width && frameSize.height ? imageRect : { inset: 0 };
  const activePosition = activeMarker && fitFrame ? projectGraphicPoint(activeMarker, frameSize, imageRect) : activeMarker;
  const lastMissedMarker = markers.find((marker) => marker.id === lastMissedMarkerId);
  const gameScore = gameSolved ? Math.max(25, 100 - (gameAttempts - 1) * 15) : 0;

  useIsomorphicLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!fitFrame || !canvas) return;
    const measure = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width && height) setFrameSize((previous) => previous.width === width && previous.height === height ? previous : { width, height });
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(canvas);
    window.addEventListener("resize", measure);
    return () => { observer?.disconnect(); window.removeEventListener("resize", measure); };
  }, [fitFrame]);

  useIsomorphicLayoutEffect(() => {
    const canvas = canvasRef.current;
    const popover = popoverRef.current;
    if (!showPopup || !activeMarker || !canvas || !popover) {
      setPopoverPosition(null);
      return;
    }

    const padding = 8;
    const gap = 12;
    const updatePosition = () => {
      const canvasBounds = canvas.getBoundingClientRect();
      const popoverBounds = popover.getBoundingClientRect();
      const canvasWidth = canvas.clientWidth || canvasBounds.width;
      const canvasHeight = canvas.clientHeight || canvasBounds.height;
      if (canvasWidth <= 0 || canvasHeight <= 0) return;
      // Position in layout pixels; slide and object transforms already scale these coordinates.
      const scaleX = canvasBounds.width / canvasWidth || 1;
      const scaleY = canvasBounds.height / canvasHeight || 1;

      const width = Math.min(popover.offsetWidth || popoverBounds.width / scaleX, Math.max(0, canvasWidth - padding * 2));
      const height = Math.min(popover.offsetHeight || popoverBounds.height / scaleY, Math.max(0, canvasHeight - padding * 2));
      const point = fitFrame ? projectGraphicPoint(activeMarker, { width: canvasWidth, height: canvasHeight }, fitGraphicImage({ width: canvasWidth, height: canvasHeight }, { width: sourceWidth || canvasWidth, height: sourceHeight || canvasHeight }, objectFit)) : activeMarker;
      const markerX = canvasWidth * (point.x / 100);
      const markerY = canvasHeight * (point.y / 100);
      const rightPosition = markerX + gap;
      const leftPosition = markerX - width - gap;
      const rightSpace = canvasWidth - markerX - gap - padding;
      const leftSpace = markerX - gap - padding;

      let left = rightSpace >= width
        ? rightPosition
        : leftSpace >= width
          ? leftPosition
          : rightSpace >= leftSpace
            ? rightPosition
            : leftPosition;
      left = Math.max(padding, Math.min(left, canvasWidth - width - padding));

      const belowPosition = markerY + gap;
      const abovePosition = markerY - height - gap;
      const belowSpace = canvasHeight - markerY - gap - padding;
      const aboveSpace = markerY - gap - padding;
      let top = belowSpace >= height
        ? belowPosition
        : aboveSpace >= height
          ? abovePosition
          : belowSpace >= aboveSpace
            ? belowPosition
            : abovePosition;
      top = Math.max(padding, Math.min(top, canvasHeight - height - padding));

      setPopoverPosition((current) => {
        if (
          current?.markerId === activeMarker.id &&
          Math.abs(current.left - left) < 0.5 &&
          Math.abs(current.top - top) < 0.5
        ) {
          return current;
        }
        return { markerId: activeMarker.id, left, top };
      });
    };

    updatePosition();
    const resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(updatePosition);
    resizeObserver?.observe(canvas);
    resizeObserver?.observe(popover);
    window.addEventListener("resize", updatePosition);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updatePosition);
    };
  }, [activeMarker?.description, activeMarker?.id, activeMarker?.label, activeMarker?.x, activeMarker?.y, showPopup, fitFrame, objectFit, sourceWidth, sourceHeight]);

  function updateMarkerPosition(
    markerId: string,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    const canvas = canvasRef.current;
    const bounds = canvas?.getBoundingClientRect();
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return;
    const pointer = { x: (event.clientX - bounds.left) / bounds.width * 100, y: (event.clientY - bounds.top) / bounds.height * 100 };
    const size = { width: canvas?.clientWidth || bounds.width, height: canvas?.clientHeight || bounds.height };
    const projected = fitFrame ? unprojectGraphicPoint(pointer, size, fitGraphicImage(size, { width: sourceWidth || size.width, height: sourceHeight || size.height }, objectFit)) : pointer;
    const x = Math.min(100, Math.max(0, projected.x));
    const y = Math.min(100, Math.max(0, projected.y));
    const position = { markerId, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 };
    dragPositionRef.current = position;
    setDragPosition(position);
  }

  function handlePointerDown(
    markerId: string,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    if (!editable || !onMarkerPositionChange) return;
    draggingPointerId.current = event.pointerId;
    dragStart.current = { x: event.clientX, y: event.clientY };
    didDrag.current = false;
    dragPositionRef.current = null;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(
    markerId: string,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    if (!editable || draggingPointerId.current !== event.pointerId) return;
    if (dragStart.current) {
      const distance = Math.hypot(
        event.clientX - dragStart.current.x,
        event.clientY - dragStart.current.y,
      );
      if (distance > 3) didDrag.current = true;
    }
    if (didDrag.current) {
      setActiveMarkerId("");
      updateMarkerPosition(markerId, event);
    }
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    if (draggingPointerId.current !== event.pointerId) return;
    draggingPointerId.current = null;
    dragStart.current = null;
    const position = dragPositionRef.current;
    dragPositionRef.current = null;
    setDragPosition(null);
    if (position && event.type !== "pointercancel") onMarkerPositionChange?.(position.markerId, { x: position.x, y: position.y });
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }

  return (
    <div
      role="group"
      aria-label={isSpotTargetGame ? challengePrompt || `Spot the clue ${blockId}` : `Interactive graphic ${blockId}`}
      className={isSpotTargetGame ? "overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-white shadow-xl" : fitFrame ? "h-full w-full min-h-0 overflow-clip" : "space-y-4"}
      onClick={(event) => {
        const target = event.target;
        if (
          target instanceof Element &&
          target.closest("button, .labeled-graphic-popover")
        ) {
          return;
        }
        setActiveMarkerId("");
      }}
    >
      {(usesIllustratedScene || usesMap) && <span className="sr-only">{alt}</span>}
      {isSpotTargetGame && (
        <div className="flex items-center justify-between gap-3 bg-slate-950 px-4 pb-3 pt-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-cyan-400/15 text-cyan-300">
              <span aria-hidden="true" className="text-lg">◎</span>
            </span>
            <div className="min-w-0">
              <p className="m-0 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">Spot the clue</p>
              <p className="m-0 truncate text-sm font-semibold text-white">{challengePrompt}</p>
            </div>
          </div>
          <div className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-right">
            <p className="m-0 text-[9px] font-bold uppercase tracking-wider text-slate-400">Score</p>
            <p className="m-0 text-lg font-black tabular-nums text-amber-300">{gameScore}</p>
          </div>
        </div>
      )}
      <div
        ref={canvasRef}
        data-testid="labeled-graphic-canvas"
        className={`relative isolate ${isSpotTargetGame ? "aspect-video overflow-hidden border-y border-white/10 bg-slate-900" : fitFrame ? "shrink-0 overflow-clip rounded-xl bg-slate-100" : usesMap ? "aspect-[18/11] overflow-hidden rounded-xl bg-slate-100" : usesIllustratedScene ? "aspect-video overflow-hidden rounded-xl bg-slate-100" : "rounded-xl bg-slate-100"}`}
        style={fitFrame ? { width: "100%", height: "100%" } : undefined}
      >
        {usesMap ? (
          <div aria-hidden="true" className="absolute" style={artworkStyle}><LessonMapArtwork template={mapTemplate!} className="size-full" stretch={fitFrame} /></div>
        ) : usesIllustratedScene ? (
          <div aria-hidden="true" className="absolute overflow-hidden" style={artworkStyle}>
            <InteractiveScene theme={sceneTheme!} stretch={fitFrame} />
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/35 via-transparent to-slate-950/10" />
          </div>
        ) : (
          <img src={src} alt={alt} className={fitFrame ? "block h-full w-full rounded-xl" : "block h-auto w-full rounded-xl"} style={fitFrame ? { objectFit } : undefined} onLoad={(event) => {
            const image = event.currentTarget;
            if (image.naturalWidth && image.naturalHeight) setImageSize({ source: src, width: image.naturalWidth, height: image.naturalHeight });
          }} />
        )}
        {markers.map((marker, index) => {
          const selected = marker.id === activeMarkerId;
          const missed = missedMarkerIds.includes(marker.id);
          const found = gameSolved && marker.isTarget;
          const pointColor = marker.color ?? sharedMarkerColor;
          const radarEnabled = marker.radarEnabled !== false;
          const sourcePosition = dragPosition?.markerId === marker.id ? dragPosition : marker;
          const position = fitFrame ? projectGraphicPoint(sourcePosition, frameSize, imageRect) : sourcePosition;
          return (
            <button
              key={marker.id}
              type="button"
              aria-label={isSpotTargetGame ? `Inspect hotspot ${index + 1}` : `${marker.label || `Marker ${index + 1}`}: show explanation`}
              aria-pressed={isSpotTargetGame ? undefined : selected}
              disabled={isSpotTargetGame && gameSolved}
              onPointerDown={(event) => handlePointerDown(marker.id, event)}
              onPointerMove={(event) => handlePointerMove(marker.id, event)}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onClick={() => {
                if (didDrag.current) {
                  didDrag.current = false;
                  return;
                }
                if (editable && onMarkerChange) {
                  setActiveMarkerId(marker.id);
                  return;
                }
                if (isSpotTargetGame) {
                  if (gameSolved) return;
                  const nextAttempt = gameAttempts + 1;
                  setGameAttempts(nextAttempt);
                  onMarkerInteract?.(marker.id);
                  if (marker.isTarget) {
                    setGameSolved(true);
                    setLastMissedMarkerId("");
                  } else {
                    setLastMissedMarkerId(marker.id);
                    setMissedMarkerIds((current) => current.includes(marker.id) ? current : [...current, marker.id]);
                  }
                  return;
                }
                setActiveMarkerId(marker.id);
                onMarkerInteract?.(marker.id);
              }}
              className={isSpotTargetGame
                ? `absolute grid size-12 -translate-x-1/2 -translate-y-1/2 touch-none place-items-center rounded-full border-2 text-sm font-black shadow-[0_0_24px_rgba(34,211,238,0.38)] transition-all hover:scale-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/80 disabled:cursor-default ${found ? "border-white bg-emerald-400 text-emerald-950 shadow-[0_0_32px_rgba(74,222,128,0.8)]" : missed ? "border-white bg-rose-500 text-white" : "border-cyan-100 bg-cyan-400/90 text-slate-950"} ${editable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`
                : `cursor-pointer ${radarEnabled ? "labeled-graphic-radar" : ""} ${parseGradient(radarColor ?? pointColor) ? "labeled-graphic-radar-gradient" : ""} absolute grid size-9 -translate-x-1/2 -translate-y-1/2 touch-none place-items-center rounded-full border-2 border-white text-xs font-bold text-white shadow-lg transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 ${editable ? "cursor-grab active:cursor-grabbing" : ""}`}
              style={{
                left: `${position.x}%`,
                top: `${position.y}%`,
                ...(!isSpotTargetGame || (!missed && !found && (marker.color || markerColor)) ? backgroundPaint(pointColor) : {}),
                color: isSpotTargetGame ? undefined : solidColor(textColor),
                "--radar-color": solidColor(radarColor ?? pointColor),
                "--radar-gradient": radarColor ?? pointColor,
              } as CSSProperties}
            >
              {isSpotTargetGame && radarEnabled && !missed && !found && <span aria-hidden="true" className="absolute inset-0 rounded-full bg-cyan-300/40 motion-safe:animate-ping" style={parseGradient(radarColor ?? pointColor) ? backgroundPaint(radarColor ?? pointColor, 40) : undefined} />}
              <span className="relative z-10" style={!isSpotTargetGame || (!missed && !found && parseGradient(textColor)) ? textPaint(textColor) : undefined}>{found ? <Check size={20} aria-hidden="true" /> : missed ? <X size={18} aria-hidden="true" /> : index + 1}</span>
            </button>
          );
        })}
        {(!isSpotTargetGame || (editable && onMarkerChange)) && showPopup && activeMarker && (
          <section
            key={activeMarker.id}
            ref={popoverRef}
            aria-live="polite"
            aria-atomic="true"
            className="labeled-graphic-popover absolute z-20 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-xl sm:p-5"
            style={{
              width: fitFrame ? "min(14rem, calc(100% - 1rem))" : undefined,
              left: popoverPosition?.markerId === activeMarker.id
                ? `${popoverPosition.left}px`
                : `${activePosition?.x ?? activeMarker.x}%`,
              top: popoverPosition?.markerId === activeMarker.id
                ? `${popoverPosition.top}px`
                : `${activePosition?.y ?? activeMarker.y}%`,
              transform: popoverPosition?.markerId === activeMarker.id
                ? undefined
                : `${activeMarker.x < 28 ? "translateX(0.5rem)" : activeMarker.x > 72 ? "translateX(calc(-100% - 0.5rem))" : "translateX(-50%)"} ${activeMarker.y > 58 ? "translateY(calc(-100% - 1rem))" : "translateY(1rem)"}`,
            }}
          >
            {editable && onMarkerChange ? <div className="space-y-2">
              <Input aria-label="Point title" value={activeMarker.label} maxLength={100} placeholder="Point title" className="h-8 text-xs" onChange={(event) => onMarkerChange(activeMarker.id, { label: event.target.value })} />
              <Textarea aria-label="Point explanation" value={activeMarker.description} maxLength={2000} placeholder="Point explanation" className="min-h-16 text-xs" onChange={(event) => onMarkerChange(activeMarker.id, { description: event.target.value })} />
              <label className="block space-y-1 text-xs text-slate-700">Point color<ColorPicker allowGradient={presentation} aria-label="Point color" value={activeMarker.color ?? markerColor ?? "#2f5f9f"} onChange={(color) => onMarkerChange(activeMarker.id, { color: color })} /></label>
              <label className="flex items-center gap-2 text-xs text-slate-700"><Checkbox aria-label="Point radar animation" checked={activeMarker.radarEnabled !== false} onChange={(event) => onMarkerChange(activeMarker.id, { radarEnabled: event.target.checked })} />Radar animation</label>
              <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setActiveMarkerId("")}>Done</Button>
            </div> : <>
            <p className="text-sm font-semibold text-slate-900">
              {activeMarker.label || `Marker ${markers.findIndex((marker) => marker.id === activeMarker.id) + 1}`}
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-700">
              {activeMarker.description || "Add an explanation for this part of the image."}
            </p>
            </>}
          </section>
        )}
      </div>
      {isSpotTargetGame && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <p
            role="status"
            aria-live="polite"
            className={`m-0 min-w-0 flex-1 text-sm font-medium ${gameSolved ? "text-emerald-300" : lastMissedMarkerId ? "text-rose-200" : "text-slate-300"}`}
          >
            {gameSolved
              ? successMessage || "Clue found! Great work scanning the scene."
              : lastMissedMarker
                ? lastMissedMarker.missFeedback || "Not that spot. Keep scanning the scene and try again."
                : "Tap a hotspot in the scene to investigate it."}
          </p>
          {gameSolved ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              aria-label="Play again"
              onClick={() => {
                setGameSolved(false);
                setGameAttempts(0);
                setLastMissedMarkerId("");
                setMissedMarkerIds([]);
              }}
              className="cursor-pointer shrink-0 gap-2"
            >
              <RotateCcw size={14} aria-hidden="true" /> Play again
            </Button>
          ) : (
            <span className="shrink-0 rounded-full bg-white/5 px-3 py-1 text-xs font-semibold text-slate-400">
              {gameAttempts} {gameAttempts === 1 ? "scan" : "scans"}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export { InteractiveProcessSteps } from "./_components/(interactive_blocks_components)/interactive-process-steps";
