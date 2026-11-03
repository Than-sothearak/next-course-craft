"use client";

import { useId, useLayoutEffect, useState, type KeyboardEvent, type ReactNode } from "react";
import { DndContext, PointerSensor, closestCorners, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { moveFlipCard, type FlipCardBlock, type FlipCard } from "@/lib/editor/flip-cards";

function SortableCard({ id, index, disabled, keyboardActive, onKeyDown, children }: { id: string; index: number; disabled: boolean; keyboardActive: boolean; onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void; children: ReactNode }) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id, disabled });
  return <div ref={setNodeRef} data-flip-card-settings={id} className={`relative min-w-0 ${isDragging ? "z-20 opacity-70" : ""}`} style={{ transform: CSS.Transform.toString(transform), transition }}>
    {children}
    <Button ref={setActivatorNodeRef} type="button" variant="ghost" size="icon" className="absolute left-1 top-1 size-7 touch-none text-slate-500" disabled={disabled} {...attributes} {...listeners} aria-pressed={keyboardActive || isDragging} onKeyDown={onKeyDown} aria-label={`Reorder flip card ${index + 1}`} title="Drag to reorder card"><GripVertical size={14} /></Button>
  </div>;
}

export function FlipCardList({ block, onChange, children }: { block: FlipCardBlock; onChange: (block: FlipCardBlock) => void; children: (card: FlipCard, index: number) => ReactNode }) {
  const id = useId();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [keyboardDrag, setKeyboardDrag] = useState<{ id: string; index: number } | null>(null);
  const preview = keyboardDrag ? moveFlipCard(block, keyboardDrag.id, keyboardDrag.index) : block;
  useLayoutEffect(() => { if (keyboardDrag) (document.activeElement as HTMLElement | null)?.scrollIntoView?.({ block: "nearest" }); }, [keyboardDrag]);
  function key(event: KeyboardEvent<HTMLButtonElement>, cardId: string, index: number) {
    if ([" ", "Enter"].includes(event.key)) {
      event.preventDefault(); event.stopPropagation();
      if (keyboardDrag) { onChange(moveFlipCard(block, keyboardDrag.id, keyboardDrag.index)); setKeyboardDrag(null); }
      else setKeyboardDrag({ id: cardId, index });
    } else if (keyboardDrag && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Escape"].includes(event.key)) {
      event.preventDefault(); event.stopPropagation();
      if (event.key === "Escape") setKeyboardDrag(null);
      else setKeyboardDrag({ ...keyboardDrag, index: Math.max(0, Math.min(block.data.cards.length - 1, keyboardDrag.index + (["ArrowUp", "ArrowLeft"].includes(event.key) ? -1 : 1))) });
    }
  }
  return <DndContext id={`flip-cards-${id}`} sensors={sensors} collisionDetection={closestCorners} onDragEnd={({ active, over }) => { if (over && active.id !== over.id) onChange(moveFlipCard(block, String(active.id), block.data.cards.findIndex((card) => card.id === over.id))); }}><SortableContext items={preview.data.cards.map((card) => card.id)} strategy={verticalListSortingStrategy}><div className="space-y-2">{preview.data.cards.map((card, index) => <SortableCard key={card.id} id={card.id} index={index} disabled={block.data.cards.length < 2} keyboardActive={keyboardDrag?.id === card.id} onKeyDown={(event) => key(event, card.id, index)}>{children(card, index)}</SortableCard>)}</div></SortableContext><span role="status" aria-live="polite" className="sr-only">{keyboardDrag ? `Card at position ${keyboardDrag.index + 1}. Use arrow keys to move, Space or Enter to drop, Escape to cancel.` : "Use Space or Enter on a card handle to reorder with the keyboard."}</span></DndContext>;
}
