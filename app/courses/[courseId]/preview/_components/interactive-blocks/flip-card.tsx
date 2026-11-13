"use client";

import { useState, type CSSProperties } from "react";
/* eslint-disable @next/next/no-img-element -- Shared learner media also renders in standalone static exports. */
import type { ContentBlock } from "@/lib/schemas/block";
import { getFlipCardProgressId } from "@/lib/export/progress";
import { backgroundPaint, solidColor, textPaint } from "@/lib/color";
import { PresentationFlipCardGrid, presentationCardStyle } from "@/components/flip-cards/presentation-flip-card-grid";
import { defaultFlipCardLayout, type FlipCardLayout } from "@/lib/editor/flip-cards";

type FlipCard = Extract<ContentBlock, { type: "flipCard" }>['data']['cards'][number];
type FlipCardStyle = Extract<ContentBlock, { type: "flipCard" }>['data']['cardStyle'];


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
  presentationLayout,
}: {
  blockId: string;
  cards: FlipCard[];
  presentationLayout?: FlipCardLayout;
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

  const items = cards.map((card, index) => <InteractiveFlipCardItem
    key={card.id} card={card} cardNumber={index + 1} presentation={presentation}
    layout={presentation ? presentationLayout ?? defaultFlipCardLayout : undefined}
    cardStyle={cardStyle} cardBackgroundColor={card.backgroundColor ?? cardBackgroundColor} cardTextColor={card.textColor ?? cardTextColor}
    initiallyRevealed={interactedCardIds.has(getFlipCardProgressId(blockId, card.id))}
    onReveal={() => onCardReveal?.(getFlipCardProgressId(blockId, card.id))}
  />);
  if (presentation) return <PresentationFlipCardGrid count={cards.length} columns={cardsPerRow} layout={presentationLayout}>{items}</PresentationFlipCardGrid>;
  return <div className="@container/flip-cards mx-auto w-full min-w-0"><div className={cards.length > 1 ? `grid min-w-0 grid-cols-1 gap-3 @min-[36rem]/flip-cards:gap-4 ${gridColumns}` : "w-full min-w-0"}>{items}</div></div>;
}

function FlipCardFace({ card, side, presentation, textColor }: { card: FlipCard; side: "front" | "back"; presentation: boolean; textColor: string }) {
  const label = side === "front" ? card.frontLabel : card.backLabel;
  const face = side === "front" ? card.front : card.back;
  return (
    <>
      <span style={textPaint(textColor)} className={`shrink-0 min-w-0 max-w-full whitespace-pre-wrap [overflow-wrap:anywhere] font-semibold uppercase tracking-[0.14em] opacity-65 ${presentation ? "mb-2 text-[10px]" : "mb-3 text-xs"}`}>{label || (side === "front" ? "Question" : "Answer")}</span>
      {face.type === "image" ? (
        <img src={face.src} alt={face.alt} className={`h-auto w-auto max-w-full rounded-lg object-contain ${presentation ? "min-h-0 flex-1 max-h-full" : "max-h-56"}`} />
      ) : (
        <span data-block-text-role={side === "front" ? "title" : "body"} style={textPaint(textColor)} className={`min-w-0 w-full max-w-full whitespace-pre-wrap break-words ${presentation ? "min-h-0 flex-1 overflow-y-auto content-center" : ""} [overflow-wrap:anywhere] ${presentation ? side === "front" ? "text-sm font-semibold @min-[30rem]/flip-cards:text-base" : "text-xs @min-[30rem]/flip-cards:text-sm" : side === "front" ? "text-lg font-semibold @min-[36rem]/flip-cards:text-xl" : "text-base @min-[36rem]/flip-cards:text-lg"}`}>
          {face.text || (side === "front" ? "Add a prompt for your learner." : "Add the answer or explanation here.")}
        </span>
      )}
      <span style={textPaint(textColor)} className={`shrink-0 font-medium opacity-70 ${presentation ? "mt-2 text-[10px]" : "mt-4 text-xs @min-[36rem]/flip-cards:mt-5"}`}>
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
  layout,
}: {
  card: FlipCard;
  cardNumber: number;
  cardStyle: FlipCardStyle;
  cardBackgroundColor: string;
  cardTextColor: string;
  initiallyRevealed: boolean;
  layout?: FlipCardLayout;
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
      data-flip-card-id={card.id}
      data-slide-animation-item
      onClick={flip}
      className={`cursor-pointer group w-full min-w-0 ${presentation ? "h-full min-h-0" : ""} ${flipCardStyleClasses[cardStyle]} text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-4`}
      // Orthographic rotation keeps slide faces inside their tightly fitted cells.
      // Clip content on the faces themselves, never on the rotating card's button.
      style={{ perspective: presentation ? undefined : "1000px", borderRadius: layout?.borderRadius }}
    >
      <span className={`grid w-full min-w-0 transition-transform duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none ${presentation ? "h-full min-h-0" : "min-h-52"}`} style={{ transform: flipped ? "rotateY(180deg)" : undefined, transformStyle: "preserve-3d" }}>
        <span
          aria-hidden={flipped}
          className={`col-start-1 row-start-1 flex min-w-0 flex-col items-center justify-center border text-center transition-colors ${presentation ? "h-full min-h-0 overflow-hidden" : "min-h-48 p-4 @min-[36rem]/flip-cards:min-h-52 @min-[36rem]/flip-cards:p-6"} ${flipCardStyleClasses[cardStyle]}`}
          style={{ ...(layout ? presentationCardStyle({ cards: [card], cardsPerRow: 1, cardStyle, cardBackgroundColor, cardTextColor, presentationLayout: layout }, card) : flipCardSurfaceStyle(cardStyle, cardBackgroundColor, cardTextColor)), backfaceVisibility: "hidden" }}
        >
          <FlipCardFace card={card} side="front" presentation={presentation} textColor={cardTextColor} />
        </span>
        <span
          aria-hidden={!flipped}
          className={`col-start-1 row-start-1 flex min-w-0 flex-col items-center justify-center border text-center ${presentation ? "h-full min-h-0 overflow-hidden" : "min-h-48 p-4 @min-[36rem]/flip-cards:min-h-52 @min-[36rem]/flip-cards:p-6"} ${flipCardStyleClasses[cardStyle]}`}
          style={{ ...(layout ? presentationCardStyle({ cards: [card], cardsPerRow: 1, cardStyle, cardBackgroundColor, cardTextColor, presentationLayout: layout }, card) : flipCardSurfaceStyle(cardStyle, cardBackgroundColor, cardTextColor)), backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          <FlipCardFace card={card} side="back" presentation={presentation} textColor={cardTextColor} />
        </span>
      </span>
    </button>
  );
}

