"use client";

/* eslint-disable @next/next/no-img-element -- Card images also render in standalone learners. */
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Copy, ImagePlus, RotateCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog } from "@/components/ui/dialog";
import { MediaLibraryDialog } from "@/app/courses/[courseId]/edit/_components/media-library-dialog";
import { PresentationFlipCardGrid, presentationCardStyle } from "@/components/flip-cards/presentation-flip-card-grid";
import { InteractiveFlipCard } from "@/app/courses/[courseId]/preview/interactive-blocks";
import { createClientId } from "@/lib/client-id";
import { duplicateFlipCard, moveFlipCard, defaultFlipCardLayout, type FlipCardBlock, type FlipCard } from "@/lib/editor/flip-cards";
import { solidColor } from "@/lib/color";

function CardToolbar({ anchor, children }: { anchor: HTMLElement; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number; width: number }>();
  const [blockedByModal, setBlockedByModal] = useState(false);
  useLayoutEffect(() => {
    const modalSelector = 'dialog[open], [role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]';
    const checkModals = () => {
      const owner = anchor.closest(modalSelector);
      const blocked = [...document.querySelectorAll<HTMLElement>(modalSelector)].some((modal) =>
        !modal.closest('[hidden], [aria-hidden="true"]') && modal !== owner && (!owner || !modal.contains(owner)),
      );
      setBlockedByModal(blocked);
    };
    checkModals();
    const observer = new MutationObserver(checkModals);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["open", "role", "aria-modal", "aria-hidden", "hidden"] });
    return () => observer.disconnect();
  }, [anchor]);
  useLayoutEffect(() => {
    const canvas = anchor.closest<HTMLElement>("[data-slide-canvas]");
    const stage = anchor.closest<HTMLElement>("[data-slide-stage]");
    const object = anchor.closest<HTMLElement>("[data-slide-object-frame]");
    const measure = () => {
      const rect = anchor.getBoundingClientRect(), canvasRect = canvas?.getBoundingClientRect(), stageRect = stage?.getBoundingClientRect();
      const left = Math.max(8, canvasRect?.left ?? 0, stageRect?.left ?? 0), right = Math.min(window.innerWidth - 8, canvasRect?.right ?? window.innerWidth, stageRect?.right ?? window.innerWidth);
      const top = Math.max(8, canvasRect?.top ?? 0, stageRect?.top ?? 0), bottom = Math.min(window.innerHeight - 8, canvasRect?.bottom ?? window.innerHeight, stageRect?.bottom ?? window.innerHeight);
      const width = Math.max(0, Math.min(380, right - left));
      const height = ref.current?.offsetHeight || 36;
      setPosition({ left: Math.max(left, Math.min(rect.left + (rect.width - width) / 2, right - width)), top: Math.max(top, Math.min(rect.bottom + 12 + height <= bottom ? rect.bottom + 12 : rect.top - height - 12, bottom - height)), width });
    };
    measure();
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    resize?.observe(anchor);
    if (stage) resize?.observe(stage);
    if (ref.current) resize?.observe(ref.current);
    const mutation = new MutationObserver(measure);
    if (object) mutation.observe(object, { attributes: true, subtree: true, attributeFilter: ["style"] });
    if (canvas) mutation.observe(canvas, { attributes: true, attributeFilter: ["style"] });
    window.addEventListener("resize", measure); window.addEventListener("scroll", measure, true);
    return () => { resize?.disconnect(); mutation.disconnect(); window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure, true); };
  }, [anchor]);
  return createPortal(<div ref={ref} role="toolbar" aria-label="Selected flip card actions" hidden={blockedByModal} className="fixed z-40 flex flex-wrap items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white p-1 text-slate-700 shadow-lg [&[hidden]]:hidden" style={position} onPointerDown={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>{children}</div>, anchor.closest("dialog[open]") ?? document.body);
}

export function SlideFlipCardEditor({ block, courseId, active, onChange }: { block: FlipCardBlock; courseId: string; active: boolean; onChange: (block: FlipCardBlock) => void }) {
  const root = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sides, setSides] = useState<Record<string, "front" | "back">>({});
  const [imageTarget, setImageTarget] = useState<{ id: string; side: "front" | "back" } | null>(null);
  const [preview, setPreview] = useState(false);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const selected = block.data.cards.find((card) => card.id === selectedId);
  const index = block.data.cards.findIndex((card) => card.id === selectedId);
  const side = selected ? sides[selected.id] ?? "front" : "front";
  useLayoutEffect(() => {
    const measure = () => setAnchor(active && !preview ? [...(root.current?.querySelectorAll<HTMLElement>("[data-flip-card-id]") ?? [])].find((element) => element.dataset.flipCardId === selectedId) ?? null : null);
    measure();
  }, [active, selectedId, block.data.cards, preview]);
  const layout = block.data.presentationLayout ?? defaultFlipCardLayout;
  function update(id: string, updateCard: (card: FlipCard) => FlipCard) { onChange({ ...block, data: { ...block.data, cards: block.data.cards.map((card) => card.id === id ? updateCard(card) : card) } }); }
  function duplicate() {
    if (!selected) return;
    const id = createClientId();
    const next = duplicateFlipCard(block, selected.id, id);
    if (next !== block) { onChange(next); setSelectedId(id); }
  }
  return <div ref={root} data-slide-flip-card-editor className="relative h-full min-h-0 w-full" onKeyDown={(event) => event.stopPropagation()}>
    {preview && active ? <><InteractiveFlipCard blockId={block.id} {...block.data} presentation /><Button type="button" size="sm" className="absolute right-2 top-2 z-10" onClick={() => setPreview(false)}>Back to editing</Button></> : <PresentationFlipCardGrid count={block.data.cards.length} columns={block.data.cardsPerRow} layout={block.data.presentationLayout}>
      {block.data.cards.map((card, cardIndex) => {
        const currentSide = sides[card.id] ?? "front", face = card[currentSide];
        const style = presentationCardStyle(block.data, card);
        const fieldStyle = { color: solidColor(card.textColor ?? block.data.cardTextColor), textAlign: layout.textAlign };
        return <div key={card.id} data-flip-card-id={card.id} data-slide-animation-item role="group" aria-label={`Edit flip card ${cardIndex + 1}`} tabIndex={active ? 0 : -1} onPointerDown={() => setSelectedId(card.id)} onFocusCapture={() => setSelectedId(card.id)} className={`flex h-full min-h-0 min-w-0 flex-col overflow-hidden border ${active && selectedId === card.id ? "outline-2 outline-offset-1 outline-indigo-500" : ""}`} style={style}>
          <Input aria-label={`Canvas card ${cardIndex + 1} ${currentSide} label`} maxLength={80} value={card[currentSide === "front" ? "frontLabel" : "backLabel"]} readOnly={!active} style={fieldStyle} className="h-7 shrink-0 rounded-none border-0 bg-transparent px-0 py-1 text-xs font-semibold uppercase shadow-none focus-visible:ring-1" onChange={(event) => update(card.id, (current) => ({ ...current, [currentSide === "front" ? "frontLabel" : "backLabel"]: event.target.value }))} />
          {face.type === "text" ? <Textarea aria-label={`Canvas card ${cardIndex + 1} ${currentSide} text`} maxLength={2000} value={face.text} readOnly={!active} style={fieldStyle} className="min-h-0 flex-1 resize-none rounded-none border-0 bg-transparent px-0 py-2 text-sm shadow-none focus-visible:ring-1" onChange={(event) => update(card.id, (current) => ({ ...current, [currentSide]: { ...face, text: event.target.value } }))} /> : <button type="button" className="min-h-0 flex-1" aria-label={`Replace card ${cardIndex + 1} ${currentSide} image`} onClick={() => { if (active) setImageTarget({ id: card.id, side: currentSide }); }}><img src={face.src} alt={face.alt} className="h-full w-full object-contain" /></button>}
          <span className="shrink-0 text-xs opacity-60">{currentSide === "front" ? "Front" : "Back"}</span>
        </div>;
      })}
    </PresentationFlipCardGrid>}
    {anchor && selected && !preview && <CardToolbar anchor={anchor}>
      <span className="px-1 text-xs">Card {index + 1}</span>
      {(["front", "back"] as const).map((value) => <Button key={value} type="button" size="sm" variant={side === value ? "secondary" : "ghost"} className="h-7 px-2 text-xs capitalize" aria-label={`Edit card ${value}`} aria-pressed={side === value} onClick={() => setSides((current) => ({ ...current, [selected.id]: value }))}>{value}</Button>)}
      <Button type="button" size="icon" variant="ghost" className="size-7" title="Duplicate card" aria-label="Duplicate selected card" disabled={block.data.cards.length >= 30} onClick={duplicate}><Copy size={14} /></Button>
      <Button type="button" size="icon" variant="ghost" className="size-7" title="Move card left" aria-label="Move selected card left" disabled={index === 0} onClick={() => onChange(moveFlipCard(block, selected.id, index - 1))}><ArrowLeft size={14} /></Button>
      <Button type="button" size="icon" variant="ghost" className="size-7" title="Move card right" aria-label="Move selected card right" disabled={index === block.data.cards.length - 1} onClick={() => onChange(moveFlipCard(block, selected.id, index + 1))}><ArrowRight size={14} /></Button>
      <Button type="button" size="icon" variant="ghost" className="size-7" title="Replace card image" aria-label="Replace selected card image" onClick={() => setImageTarget({ id: selected.id, side })}><ImagePlus size={14} /></Button>
      <Button type="button" size="icon" variant="ghost" className="size-7" title="Preview flip" aria-label="Preview flip cards" onClick={() => setPreview(true)}><RotateCw size={14} /></Button>
      <Button type="button" size="icon" variant="ghost" className="size-7 text-rose-600" title="Delete card" aria-label="Delete selected card" disabled={block.data.cards.length <= 1} onClick={() => onChange({ ...block, data: { ...block.data, cards: block.data.cards.filter((card) => card.id !== selected.id) } })}><Trash2 size={14} /></Button>
    </CardToolbar>}
    {imageTarget && active && <Dialog open title="Replace card image" className="max-w-4xl" onClose={() => setImageTarget(null)}><MediaLibraryDialog embedded courseId={courseId} kind="image" open onClose={() => setImageTarget(null)} onSelect={(asset) => update(imageTarget.id, (card) => { const face = card[imageTarget.side]; return { ...card, [imageTarget.side]: { type: "image", src: asset.fileUrl, alt: face.type === "image" ? face.alt : asset.originalName.slice(0, 500) } }; })} /></Dialog>}
  </div>;
}
