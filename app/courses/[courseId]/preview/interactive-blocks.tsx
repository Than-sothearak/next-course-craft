"use client";

/* eslint-disable @next/next/no-img-element -- This component is also bundled into static course exports. */
import { useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { evaluateKnowledgeCheckAnswer } from "@/lib/interactive/knowledge-check";
import { getFlipCardProgressId } from "@/lib/export/progress";
import type { ContentBlock } from "@/lib/schemas/block";

type FlipCard = Extract<ContentBlock, { type: "flipCard" }>['data']['cards'][number];
type AccordionItem = Extract<ContentBlock, { type: "accordion" }>['data']['items'][number];
type GraphicMarker = Extract<ContentBlock, { type: "labeledGraphic" }>['data']['markers'][number];

export function InteractiveFlipCard({
  blockId,
  cards,
  interactedCardIds = new Set(),
  onCardReveal,
}: {
  blockId: string;
  cards: FlipCard[];
  interactedCardIds?: ReadonlySet<string>;
  onCardReveal?: (progressId: string) => void;
}) {
  const gridColumns = cards.length === 3
    ? "@min-[36rem]/flip-cards:grid-cols-2 @min-[56rem]/flip-cards:grid-cols-3"
    : "@min-[36rem]/flip-cards:grid-cols-2";

  return (
    <div className="@container/flip-cards mx-auto w-full min-w-0">
      <div className={cards.length > 1 ? `grid min-w-0 grid-cols-1 gap-3 @min-[36rem]/flip-cards:gap-4 ${gridColumns}` : "w-full min-w-0"}>
        {cards.map((card, index) => (
          <InteractiveFlipCardItem
            key={card.id}
            card={card}
            cardNumber={index + 1}
            initiallyRevealed={interactedCardIds.has(getFlipCardProgressId(blockId, card.id))}
            onReveal={() => onCardReveal?.(getFlipCardProgressId(blockId, card.id))}
          />
        ))}
      </div>
    </div>
  );
}

function FlipCardFace({ card, side }: { card: FlipCard; side: "front" | "back" }) {
  const label = side === "front" ? card.frontLabel : card.backLabel;
  const face = side === "front" ? card.front : card.back;
  return (
    <>
      <span className="mb-3 min-w-0 max-w-full whitespace-pre-wrap [overflow-wrap:anywhere] text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label || (side === "front" ? "Question" : "Answer")}</span>
      {face.type === "image" ? (
        <img src={face.src} alt={face.alt} className="h-auto w-auto max-h-56 max-w-full rounded-lg object-contain" />
      ) : (
        <span className={`min-w-0 max-w-full whitespace-pre-wrap break-words [overflow-wrap:anywhere] ${side === "front" ? "text-lg font-semibold text-slate-900 @min-[36rem]/flip-cards:text-xl" : "text-base text-slate-800 @min-[36rem]/flip-cards:text-lg"}`}>
          {face.text || (side === "front" ? "Add a prompt for your learner." : "Add the answer or explanation here.")}
        </span>
      )}
      <span className="mt-4 text-xs font-medium @min-[36rem]/flip-cards:mt-5" style={{ color: "var(--course-primary, #2f5f9f)" }}>
        {side === "front" ? "Click to flip" : "Click to flip back"}
      </span>
    </>
  );
}

function InteractiveFlipCardItem({
  card,
  cardNumber,
  initiallyRevealed,
  onReveal,
}: {
  card: FlipCard;
  cardNumber: number;
  initiallyRevealed: boolean;
  onReveal: () => void;
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
      className="group w-full min-w-0 rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-4"
      style={{ perspective: "1000px" }}
    >
      <span className="grid min-h-52 w-full min-w-0 transition-transform duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none" style={{ transform: flipped ? "rotateY(180deg)" : undefined, transformStyle: "preserve-3d" }}>
        <span
          aria-hidden={flipped}
          className="col-start-1 row-start-1 flex min-h-48 min-w-0 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm transition-colors group-hover:border-slate-300 @min-[36rem]/flip-cards:min-h-52 @min-[36rem]/flip-cards:p-6"
          style={{ backfaceVisibility: "hidden" }}
        >
          <FlipCardFace card={card} side="front" />
        </span>
        <span
          aria-hidden={!flipped}
          className="col-start-1 row-start-1 flex min-h-48 min-w-0 flex-col items-center justify-center rounded-2xl border p-4 text-center shadow-sm @min-[36rem]/flip-cards:min-h-52 @min-[36rem]/flip-cards:p-6"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)", borderColor: "color-mix(in srgb, var(--course-primary, #2f5f9f) 28%, white)", backgroundColor: "color-mix(in srgb, var(--course-primary, #2f5f9f) 7%, white)" }}
        >
          <FlipCardFace card={card} side="back" />
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
                className={`shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors sm:px-4 ${selected ? "border-[var(--course-primary,#2f5f9f)] text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"}`}
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
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50 sm:px-5"
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
  markers,
  markerColor,
  textColor = "#ffffff",
  radarColor,
  editable = false,
  onMarkerPositionChange,
  onMarkerInteract,
}: {
  blockId: string;
  src: string;
  alt: string;
  markers: GraphicMarker[];
  markerColor?: string;
  textColor?: string;
  radarColor?: string;
  editable?: boolean;
  onMarkerPositionChange?: (markerId: string, position: { x: number; y: number }) => void;
  onMarkerInteract?: (markerId: string) => void;
}) {
  const [activeMarkerId, setActiveMarkerId] = useState("");
  const canvasRef = useRef<HTMLDivElement>(null);
  const draggingPointerId = useRef<number | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const didDrag = useRef(false);
  const activeMarker = markers.find((marker) => marker.id === activeMarkerId) ?? markers[0];
  const showPopup = activeMarkerId !== "" && activeMarker?.id === activeMarkerId;
  const sharedMarkerColor =
    markerColor ?? markers[0]?.color ?? "var(--course-primary, #2f5f9f)";
  const sharedRadarColor = radarColor ?? sharedMarkerColor;

  function updateMarkerPosition(
    markerId: string,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    const bounds = canvasRef.current?.getBoundingClientRect();
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return;
    const x = Math.min(100, Math.max(0, ((event.clientX - bounds.left) / bounds.width) * 100));
    const y = Math.min(100, Math.max(0, ((event.clientY - bounds.top) / bounds.height) * 100));
    onMarkerPositionChange?.(markerId, {
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
    });
  }

  function handlePointerDown(
    markerId: string,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    if (!editable || !onMarkerPositionChange) return;
    draggingPointerId.current = event.pointerId;
    dragStart.current = { x: event.clientX, y: event.clientY };
    didDrag.current = false;
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
    if (didDrag.current) updateMarkerPosition(markerId, event);
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    if (draggingPointerId.current !== event.pointerId) return;
    draggingPointerId.current = null;
    dragStart.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }

  return (
    <div
      role="group"
      aria-label={`Interactive graphic ${blockId}`}
      className="space-y-4"
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
      <div
        ref={canvasRef}
        data-testid="labeled-graphic-canvas"
        className="relative isolate rounded-xl bg-slate-100"
      >
        <img src={src} alt={alt} className="block h-auto w-full rounded-xl" />
        {markers.map((marker, index) => {
          const selected = marker.id === activeMarkerId;
          return (
            <button
              key={marker.id}
              type="button"
              aria-label={`${marker.label || `Marker ${index + 1}`}: show explanation`}
              aria-pressed={selected}
              onPointerDown={(event) => handlePointerDown(marker.id, event)}
              onPointerMove={(event) => handlePointerMove(marker.id, event)}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onClick={() => {
                if (didDrag.current) {
                  didDrag.current = false;
                  return;
                }
                setActiveMarkerId(marker.id);
                onMarkerInteract?.(marker.id);
              }}
              className={`labeled-graphic-radar absolute grid size-9 -translate-x-1/2 -translate-y-1/2 touch-none place-items-center rounded-full border-2 border-white text-xs font-bold text-white shadow-lg transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 ${editable ? "cursor-grab active:cursor-grabbing" : ""}`}
              style={{
                left: `${marker.x}%`,
                top: `${marker.y}%`,
                backgroundColor: sharedMarkerColor,
                color: textColor,
                "--radar-color": sharedRadarColor,
              } as CSSProperties}
            >
              <span className="relative z-10">{index + 1}</span>
            </button>
          );
        })}
        {showPopup && activeMarker && (
          <section
            key={activeMarker.id}
            aria-live="polite"
            aria-atomic="true"
            className="labeled-graphic-popover absolute z-20 w-[min(17rem,calc(100vw-3rem))] rounded-xl border border-slate-200 bg-white p-4 text-left shadow-xl sm:p-5"
            style={{
              left: `${activeMarker.x}%`,
              top: `${activeMarker.y}%`,
              transform: `${
                activeMarker.x < 28
                  ? "translateX(0.5rem)"
                  : activeMarker.x > 72
                    ? "translateX(calc(-100% - 0.5rem))"
                    : "translateX(-50%)"
              } ${activeMarker.y > 58 ? "translateY(calc(-100% - 1rem))" : "translateY(1rem)"}`,
            }}
          >
            <p className="text-sm font-semibold text-slate-900">
              {activeMarker.label || `Marker ${markers.findIndex((marker) => marker.id === activeMarker.id) + 1}`}
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-700">
              {activeMarker.description || "Add an explanation for this part of the image."}
            </p>
          </section>
        )}
      </div>
    </div>
  );
}

export { InteractiveProcessSteps } from "./_components/(interactive_blocks_components)/interactive-process-steps";
