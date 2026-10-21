"use client";

import { Plus, Trash2 } from "lucide-react";
import type { ContentBlock } from "@/lib/schemas/block";
import { createClientId } from "@/lib/client-id";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { FlipCard, FlipCardSide, FlipCardFace, MediaLibraryTarget } from "../content-block-types";
import type { Dispatch, SetStateAction } from "react";

export function FlipCardBlockSettings({ block, onChange, updateFlipCard, updateFlipCardFace, setMediaLibraryTarget }: { block: Extract<ContentBlock, { type: "flipCard" }>; onChange: (block: ContentBlock) => void; updateFlipCard: (cardId: string, update: (card: FlipCard) => FlipCard) => void; updateFlipCardFace: (cardId: string, side: FlipCardSide, face: FlipCardFace) => void; setMediaLibraryTarget: Dispatch<SetStateAction<MediaLibraryTarget | null>> }) {
  return (
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
              id: `card-${createClientId()}`,
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
  );
}
