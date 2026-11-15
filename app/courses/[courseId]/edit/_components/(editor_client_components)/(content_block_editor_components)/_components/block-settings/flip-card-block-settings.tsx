"use client";

import { ColorPicker } from "@/components/ui/color-picker";

import { Plus, Trash2, Copy, ArrowLeft, ArrowRight, ChevronDown, Layers, LayoutGrid, Paintbrush, RotateCw } from "lucide-react";
import type { ContentBlock } from "@/lib/schemas/block";
import { createClientId } from "@/lib/client-id";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { SettingsSection } from "@/components/ui/settings-section";
import { FlipCardSidePanels } from "./flip-card-side-panels";
import type { FlipCard, FlipCardSide, FlipCardFace, MediaLibraryTarget } from "../content-block-types";
import type { Dispatch, SetStateAction } from "react";

import { NumberInput } from "@/components/ui/number-input";
import { FlipCardList } from "@/components/flip-cards/flip-card-list";
import { defaultFlipCardLayout, duplicateFlipCard, moveFlipCard, type FlipCardLayout } from "@/lib/editor/flip-cards";
export function FlipCardBlockSettings({ block, onChange, updateFlipCard, updateFlipCardFace, setMediaLibraryTarget, presentation = false }: { block: Extract<ContentBlock, { type: "flipCard" }>; presentation?: boolean; onChange: (block: ContentBlock) => void; updateFlipCard: (cardId: string, update: (card: FlipCard) => FlipCard) => void; updateFlipCardFace: (cardId: string, side: FlipCardSide, face: FlipCardFace) => void; setMediaLibraryTarget: Dispatch<SetStateAction<MediaLibraryTarget | null>> }) {
  const layout = block.data.presentationLayout ?? defaultFlipCardLayout;
  const setLayout = (update: Partial<FlipCardLayout>) => onChange({ ...block, data: { ...block.data, presentationLayout: { ...layout, ...update } } });
  const cardStyles = [
    { value: "classic", label: "Classic" },
    { value: "soft", label: "Soft" },
    { value: "outlined", label: "Outlined" },
    { value: "elevated", label: "Elevated" },
    { value: "realistic", label: "Realistic" },
  ] as const;
  return <div data-flip-card-content-settings className="min-w-0 space-y-3">
    <section aria-label="Cards" className="min-w-0 space-y-3">
      <div className="flex items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-xs font-semibold text-slate-700"><Layers size={15} aria-hidden="true" className="text-slate-500" />Cards</h3><Badge variant="secondary" aria-label={`${block.data.cards.length} of 30 cards`} className="shrink-0 text-[10px]">{block.data.cards.length}/30</Badge></div>
      <FlipCardList block={block} onChange={onChange}>{(card, index) => (
        <details key={card.id} open={index === 0} className="group/card min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm open:border-indigo-200">
          <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2 py-2 pl-9 pr-3 text-xs text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 [&::-webkit-details-marker]:hidden">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-indigo-50 font-semibold text-indigo-700">{String(index + 1).padStart(2, "0")}</span>
            <span className="min-w-0 flex-1"><span className="block font-semibold">Card {index + 1}</span><span className="mt-0.5 block truncate text-[11px] font-normal text-slate-500">{card.front.type === "text" ? card.front.text.trim() || "Add a question or prompt" : card.front.alt || "Image on front"}</span></span>
            <ChevronDown size={14} aria-hidden="true" className="shrink-0 text-slate-400 transition-transform group-open/card:rotate-180" />
          </summary>
          <div className="space-y-3 border-t border-slate-100 p-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2" role="group" aria-label={`Card ${index + 1} actions`}>
            <div className="flex items-center gap-1"><Button type="button" size="icon" variant="outline" className="size-8" title="Move earlier" aria-label={`Move flip card ${index + 1} left`} disabled={index === 0} onClick={() => onChange(moveFlipCard(block, card.id, index - 1))}><ArrowLeft size={14} aria-hidden="true" /></Button><Button type="button" size="icon" variant="outline" className="size-8" title="Move later" aria-label={`Move flip card ${index + 1} right`} disabled={index === block.data.cards.length - 1} onClick={() => onChange(moveFlipCard(block, card.id, index + 1))}><ArrowRight size={14} aria-hidden="true" /></Button></div>
            <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon" className="size-8" title="Duplicate card" aria-label={`Duplicate flip card ${index + 1}`} disabled={block.data.cards.length >= 30} onClick={() => onChange(duplicateFlipCard(block, card.id, createClientId()))}><Copy size={14} aria-hidden="true" /></Button>
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
              title="Delete card"
              className="size-8 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
            >
              <Trash2 size={14} />
            </Button>
          )}
            </div>
          </div>
            <FlipCardSidePanels index={index}>{(side) => {
              const face = card[side];
              const faceLabel = side === "front" ? "front" : "back";
              return (
                <fieldset key={side} aria-label={`Card ${index + 1} ${side} side`} className="min-w-0 overflow-hidden rounded-lg border border-slate-200">
                  <legend className="sr-only">{side === "front" ? "Front side" : "Back side"}</legend>
                  <div className={`flex items-center gap-2 border-b border-slate-100 px-2.5 py-2 ${side === "front" ? "bg-indigo-50/60" : "bg-slate-50"}`}>
                    <RotateCw size={13} aria-hidden="true" className={side === "front" ? "text-indigo-500" : "text-slate-400"} />
                    <span className="font-semibold text-slate-700">{side === "front" ? "Front" : "Back"}</span>
                    <span className="ml-auto text-[10px] text-slate-500">{side === "front" ? "Shown first" : "On flip"}</span>
                  </div>
                  <div className="min-w-0 space-y-3 p-2.5">
                  <label className="block space-y-1 text-xs text-slate-600"><span>Label</span>
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
                  </label>
                  <label className="block space-y-1 text-xs text-slate-600"><span>Content type</span>
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
                  </label>
                  {face.type === "text" ? (
                    <label className="block space-y-1 text-xs text-slate-600"><span>{side === "front" ? "Question or prompt" : "Answer or explanation"}</span>
                    <Textarea
                      aria-label={`Card ${index + 1} ${faceLabel} text`}
                      value={face.text}
                      maxLength={2000}
                      onChange={(event) => updateFlipCardFace(card.id, side, { ...face, text: event.target.value })}
                      placeholder={side === "front" ? "Prompt or question" : "Answer or explanation"}
                      className="min-h-24 resize-y"
                    />
                    </label>
                  ) : (
                    <div className="space-y-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-auto w-full whitespace-normal py-2"
                        onClick={() => setMediaLibraryTarget({ type: "flipCard", cardId: card.id, side })}
                      >
                        Choose from media library
                      </Button>
                      <label className="block space-y-1 text-xs text-slate-600"><span>Image URL</span><Input
                        aria-label={`Card ${index + 1} ${faceLabel} image URL`}
                        type="url"
                        value={face.src}
                        onChange={(event) => updateFlipCardFace(card.id, side, { ...face, src: event.target.value })}
                        placeholder="Image URL"
                        className="h-9"
                      /></label>
                      <label className="block space-y-1 text-xs text-slate-600"><span>Alternative text</span><Input
                        aria-label={`Card ${index + 1} ${faceLabel} image alternative text`}
                        value={face.alt}
                        maxLength={500}
                        onChange={(event) => updateFlipCardFace(card.id, side, { ...face, alt: event.target.value })}
                        placeholder="Alternative text"
                        className="h-9"
                      /></label>
                    </div>
                  )}
                  </div>
                </fieldset>
              );
            }}</FlipCardSidePanels>
            <SettingsSection title="Card appearance" label={`Card ${index + 1} appearance settings`} icon={Paintbrush} defaultOpen={false}>
              <label className="block space-y-1 text-xs text-slate-600">Front background<ColorPicker aria-label={`Card ${index + 1} front background color`} allowGradient value={card.backgroundColor ?? block.data.cardBackgroundColor} onChange={(backgroundColor) => updateFlipCard(card.id, (current) => ({ ...current, backgroundColor }))} /></label>
              <label className="block space-y-1 text-xs text-slate-600">Front text<ColorPicker aria-label={`Card ${index + 1} front text color`} allowGradient value={card.textColor ?? block.data.cardTextColor} onChange={(textColor) => updateFlipCard(card.id, (current) => ({ ...current, textColor }))} /></label>
              <Button type="button" variant="ghost" size="sm" className="h-auto w-full whitespace-normal" aria-label={`Use master front colors for card ${index + 1}`} onClick={() => updateFlipCard(card.id, (current) => ({ ...current, backgroundColor: undefined, textColor: undefined }))}>Use master front colors</Button>
            </SettingsSection>
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
        className="w-full justify-center border-dashed text-indigo-700 hover:border-indigo-300 hover:bg-indigo-50"
      >
        <Plus size={14} /> Add card
      </Button>

    </section>
    <SettingsSection title="Grid & spacing" icon={LayoutGrid}>
      {presentation && <label className="block space-y-1 text-xs">Layout<Select aria-label="Flip card grid mode" value={layout.mode} onChange={(event) => setLayout({ mode: event.target.value as FlipCardLayout["mode"] })}><option value="auto">Auto (responsive)</option><option value="custom">Custom columns</option></Select></label>}
      <label className="block space-y-1 text-xs">{presentation && layout.mode === "auto" ? "Maximum columns" : "Cards per row"}<Select aria-label="Cards per row" value={block.data.cardsPerRow} onChange={(event) => onChange({ ...block, data: { ...block.data, cardsPerRow: Number(event.target.value) } })}>{[1,2,3,4,5].map((count) => <option key={count} value={count}>{count}</option>)}</Select></label>
      {presentation && <>
        <div className="flex flex-wrap gap-1">{[1,2,3].map((columns) => <Button key={columns} type="button" variant="outline" size="sm" onClick={() => onChange({ ...block, data: { ...block.data, cardsPerRow: columns, presentationLayout: { ...layout, mode: "custom" } } })}>{columns} across</Button>)}</div>
        <p className="text-xs text-slate-500">Rows follow the card count. Cards fill the object evenly.</p>
        <div className="grid grid-cols-2 gap-2">{([["padding", "Object padding"], ["cardPadding", "Card padding"], ["columnGap", "Column gap"], ["rowGap", "Row gap"]] as const).map(([key,label]) => <label key={key} className="space-y-1 text-xs">{label} (px)<NumberInput precision={0} aria-label={`Flip card ${label.toLowerCase()}`} min={0} max={80} value={layout[key]} onValueChange={(value) => setLayout({ [key]: value })} /></label>)}</div>
      </>}
    </SettingsSection>
    <SettingsSection title="Default appearance" label="Card appearance" icon={Paintbrush}>
      <label className="block space-y-1 text-xs">Card style<Select aria-label="Card style" value={block.data.cardStyle} onChange={(event) => onChange({ ...block, data: { ...block.data, cardStyle: event.target.value as typeof block.data.cardStyle } })}>{cardStyles.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</Select></label>
      <div className="space-y-3"><label className="block space-y-1 text-xs text-slate-600">Master front background<ColorPicker aria-label="Master front background color" allowGradient value={block.data.cardBackgroundColor} onChange={(cardBackgroundColor) => onChange({ ...block, data: { ...block.data, cardBackgroundColor } })} /></label><label className="block space-y-1 text-xs text-slate-600">Master front text<ColorPicker aria-label="Master front text color" allowGradient value={block.data.cardTextColor} onChange={(cardTextColor) => onChange({ ...block, data: { ...block.data, cardTextColor } })} /></label></div>
      <p className="text-xs leading-5 text-slate-500">The default front uses a gradient from the course colors. Front color controls style the front only; the back stays near-white with dark text.</p>
      {presentation && <div className="grid grid-cols-2 gap-2"><label className="space-y-1 text-xs">Corner radius<NumberInput precision={0} aria-label="Flip card corner radius" min={0} max={80} value={layout.borderRadius} onValueChange={(borderRadius) => setLayout({ borderRadius })} /></label><label className="space-y-1 text-xs">Text alignment<Select aria-label="Flip card text alignment" value={layout.textAlign} onChange={(event) => setLayout({ textAlign: event.target.value as FlipCardLayout["textAlign"] })}>{["left","center","right"].map((value) => <option key={value}>{value}</option>)}</Select></label></div>}
    </SettingsSection>
  </div>;
}
