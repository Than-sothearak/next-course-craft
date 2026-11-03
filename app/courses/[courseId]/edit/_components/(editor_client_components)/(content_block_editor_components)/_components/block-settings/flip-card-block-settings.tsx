"use client";

import { ColorPicker } from "@/components/ui/color-picker";

import { Plus, Trash2, Copy, ArrowLeft, ArrowRight } from "lucide-react";
import type { ContentBlock } from "@/lib/schemas/block";
import { createClientId } from "@/lib/client-id";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { FlipCard, FlipCardSide, FlipCardFace, MediaLibraryTarget } from "../content-block-types";
import type { Dispatch, SetStateAction } from "react";

import { NumberInput } from "@/components/ui/number-input";
import { FlipCardList } from "@/components/flip-cards/flip-card-list";
import { defaultFlipCardLayout, duplicateFlipCard, moveFlipCard, type FlipCardLayout } from "@/lib/editor/flip-cards";
export function FlipCardBlockSettings({ block, onChange, updateFlipCard, updateFlipCardFace, setMediaLibraryTarget, presentation = false }: { block: Extract<ContentBlock, { type: "flipCard" }>; presentation?: boolean; onChange: (block: ContentBlock) => void; updateFlipCard: (cardId: string, update: (card: FlipCard) => FlipCard) => void; updateFlipCardFace: (cardId: string, side: FlipCardSide, face: FlipCardFace) => void; setMediaLibraryTarget: Dispatch<SetStateAction<MediaLibraryTarget | null>> }) {
  const layout = block.data.presentationLayout ?? defaultFlipCardLayout;
  const setLayout = (update: Partial<FlipCardLayout>) => onChange({ ...block, data: { ...block.data, presentationLayout: { ...layout, ...update } } });
  return <div className="space-y-4">
    <section aria-label="Cards" className="space-y-2"><h3 className="text-xs font-semibold text-slate-700">Cards</h3>
      <FlipCardList block={block} onChange={onChange}>{(card, index) => (
        <details key={card.id} open={index === 0} className="group/card relative rounded-lg border border-slate-200">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 pl-9 pr-20 text-sm font-medium text-slate-700">
            <span>Card {index + 1}</span>
            <span aria-hidden="true" className="text-slate-400 transition-transform group-open/card:rotate-180">⌄</span>
          </summary>
          <Button type="button" variant="ghost" size="icon" className="absolute right-9 top-1 size-8" aria-label={`Duplicate flip card ${index + 1}`} disabled={block.data.cards.length >= 30} onClick={() => onChange(duplicateFlipCard(block, card.id, createClientId()))}><Copy size={14} /></Button>
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
            <div className="flex gap-1"><Button type="button" size="sm" variant="outline" aria-label={`Move flip card ${index + 1} left`} disabled={index === 0} onClick={() => onChange(moveFlipCard(block, card.id, index - 1))}><ArrowLeft size={14} />Move left</Button><Button type="button" size="sm" variant="outline" aria-label={`Move flip card ${index + 1} right`} disabled={index === block.data.cards.length - 1} onClick={() => onChange(moveFlipCard(block, card.id, index + 1))}><ArrowRight size={14} />Move right</Button></div>
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1 text-xs">Background<ColorPicker aria-label={`Card ${index + 1} background color`} value={card.backgroundColor ?? block.data.cardBackgroundColor} onChange={(backgroundColor) => updateFlipCard(card.id, (current) => ({ ...current, backgroundColor }))} /></label>
              <label className="space-y-1 text-xs">Text<ColorPicker aria-label={`Card ${index + 1} text color`} value={card.textColor ?? block.data.cardTextColor} onChange={(textColor) => updateFlipCard(card.id, (current) => ({ ...current, textColor }))} /></label>
            </div>
            <Button type="button" variant="ghost" size="sm" aria-label={`Use master colors for card ${index + 1}`} onClick={() => updateFlipCard(card.id, (current) => ({ ...current, backgroundColor: undefined, textColor: undefined }))}>Use master colors</Button>
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
      )}</FlipCardList>
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

    </section>
    <section aria-label="Grid & spacing" className="space-y-3 border-t pt-3"><h3 className="text-xs font-semibold text-slate-700">Grid & spacing</h3>
      {presentation && <label className="block space-y-1 text-xs">Layout<Select aria-label="Flip card grid mode" value={layout.mode} onChange={(event) => setLayout({ mode: event.target.value as FlipCardLayout["mode"] })}><option value="auto">Auto (responsive)</option><option value="custom">Custom columns</option></Select></label>}
      <label className="block space-y-1 text-xs">{presentation && layout.mode === "auto" ? "Maximum columns" : "Cards per row"}<Select aria-label="Cards per row" value={block.data.cardsPerRow} onChange={(event) => onChange({ ...block, data: { ...block.data, cardsPerRow: Number(event.target.value) } })}>{[1,2,3,4,5].map((count) => <option key={count} value={count}>{count}</option>)}</Select></label>
      {presentation && <>
        <div className="flex flex-wrap gap-1">{[1,2,3].map((columns) => <Button key={columns} type="button" variant="outline" size="sm" onClick={() => onChange({ ...block, data: { ...block.data, cardsPerRow: columns, presentationLayout: { ...layout, mode: "custom" } } })}>{columns} across</Button>)}</div>
        <p className="text-xs text-slate-500">Rows follow the card count. Cards fill the object evenly.</p>
        <div className="grid grid-cols-2 gap-2">{([["padding", "Object padding"], ["cardPadding", "Card padding"], ["columnGap", "Column gap"], ["rowGap", "Row gap"]] as const).map(([key,label]) => <label key={key} className="space-y-1 text-xs">{label} (px)<NumberInput precision={0} aria-label={`Flip card ${label.toLowerCase()}`} min={0} max={80} value={layout[key]} onValueChange={(value) => setLayout({ [key]: value })} /></label>)}</div>
      </>}
    </section>
    <section aria-label="Card appearance" className="space-y-3 border-t pt-3"><h3 className="text-xs font-semibold text-slate-700">Card appearance</h3>
      <label className="block space-y-1 text-xs">Card style<Select aria-label="Card style" value={block.data.cardStyle} onChange={(event) => onChange({ ...block, data: { ...block.data, cardStyle: event.target.value as typeof block.data.cardStyle } })}>{["classic","soft","outlined","elevated"].map((style) => <option key={style} value={style}>{style}</option>)}</Select></label>
      <div className="grid grid-cols-2 gap-2"><label className="space-y-1 text-xs">Master background<ColorPicker aria-label="Card background color" value={block.data.cardBackgroundColor} onChange={(cardBackgroundColor) => onChange({ ...block, data: { ...block.data, cardBackgroundColor } })} /></label><label className="space-y-1 text-xs">Master text<ColorPicker aria-label="Card text color" value={block.data.cardTextColor} onChange={(cardTextColor) => onChange({ ...block, data: { ...block.data, cardTextColor } })} /></label></div>
      {presentation && <div className="grid grid-cols-2 gap-2"><label className="space-y-1 text-xs">Corner radius<NumberInput precision={0} aria-label="Flip card corner radius" min={0} max={80} value={layout.borderRadius} onValueChange={(borderRadius) => setLayout({ borderRadius })} /></label><label className="space-y-1 text-xs">Text alignment<Select aria-label="Flip card text alignment" value={layout.textAlign} onChange={(event) => setLayout({ textAlign: event.target.value as FlipCardLayout["textAlign"] })}>{["left","center","right"].map((value) => <option key={value}>{value}</option>)}</Select></label></div>}
    </section>
  </div>;
}
