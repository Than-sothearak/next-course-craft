"use client";

import { useId } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useReducedMotion } from "framer-motion";
import { GripVertical, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSlideLayers } from "@/lib/editor/slide-layers";
import type { ContentBlock } from "@/lib/schemas/block";
import { objectIcons, objectLabels } from "./slide-object-labels";

type Props = {
  blocks: ContentBlock[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onReorder: (activeId: string, overId: string) => void;
};

function Layer({ block, index, total, selectedId, onSelect }: Pick<Props, "selectedId" | "onSelect"> & { block: ContentBlock; index: number; total: number }) {
  const Icon = objectIcons[block.type] ?? Layers;
  const label = objectLabels[block.type] ?? block.type;
  const reducedMotion = useReducedMotion();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: block.id, disabled: total < 2 });
  return <div ref={setNodeRef} data-slide-layer={block.id} className={`relative flex min-w-0 items-center gap-1 rounded-md border p-1 ${selectedId === block.id ? "border-indigo-200 bg-indigo-50" : "border-slate-200 bg-white"} ${isDragging ? "z-30 opacity-70" : ""}`} style={{ transform: CSS.Transform.toString(transform), transition: reducedMotion ? undefined : transition }}>
    <Button ref={setActivatorNodeRef} variant="ghost" size="icon" {...attributes} {...listeners} aria-label={`Reorder ${label.toLowerCase()} layer ${index + 1}`} title="Drag to reorder layer" disabled={total < 2} className="size-7 shrink-0 touch-none text-slate-500" style={{ cursor: isDragging ? "grabbing" : "grab" }}><GripVertical size={14} aria-hidden="true" /></Button>
    <Button variant="ghost" size="sm" onClick={() => onSelect(block.id)} aria-label={`Select ${block.type} object from layers`} aria-pressed={selectedId === block.id} className="min-w-0 flex-1 justify-start gap-2 px-1"><Icon size={14} aria-hidden="true" className="shrink-0" /><span className="truncate capitalize">{index + 1}. {label}</span></Button>
  </div>;
}

export function SlideObjectLayers({ blocks, selectedId, onSelect, onReorder }: Props) {
  const id = `slide-layers-${useId().replaceAll(":", "")}`;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const layers = getSlideLayers(blocks);
  function reorder({ active, over }: DragEndEvent) {
    if (over && active.id !== over.id && blocks.some((block) => block.id === active.id) && blocks.some((block) => block.id === over.id)) onReorder(String(active.id), String(over.id));
  }
  return <div className="space-y-2">
    <p className="text-[11px] text-slate-500">Front to back. Drag a handle to change the stacking order.</p>
    <DndContext id={id} sensors={sensors} collisionDetection={closestCenter} onDragEnd={reorder} accessibility={{ screenReaderInstructions: { draggable: "To reorder a layer, press Space or Enter on its handle, use the arrow keys to move it, and press Space or Enter to drop. Press Escape to cancel." } }}>
      <SortableContext items={layers.map((block) => block.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-1.5">{layers.map((block, index) => <Layer key={block.id} block={block} index={index} total={layers.length} selectedId={selectedId} onSelect={onSelect} />)}</div>
      </SortableContext>
    </DndContext>
  </div>;
}
