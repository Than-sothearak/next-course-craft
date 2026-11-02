"use client";

import { useId, useState, type MouseEvent } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useReducedMotion } from "framer-motion";
import { ChevronDown, ChevronRight, Eye, EyeOff, GripVertical, Layers, Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { slideSelectionUnits, type SelectionUnit } from "@/lib/editor/slide-selection";
import type { ContentBlock } from "@/lib/schemas/block";
import { objectIcons, objectLabels } from "./slide-object-labels";

type Props = {
  blocks: ContentBlock[]; selectedId: string | null; selectedIds?: string[];
  onSelect: (id: string, modifiers?: MouseEvent) => void;
  onToggleSelect?: (id: string) => void;
  onSelectMember?: (id: string) => void;
  onToggleFlag?: (id: string, flag: "slideLocked" | "slideHiddenInEditor") => void;
  onReorder: (activeId: string, overId: string) => void;
};

function Layer({ unit, index, total, selectedId, selectedIds, onSelect, onToggleSelect, onSelectMember, onToggleFlag }: Omit<Props, "blocks" | "onReorder"> & { unit: SelectionUnit; index: number; total: number }) {
  const [expanded, setExpanded] = useState(false);
  const block = unit.blocks[0], grouped = unit.id.startsWith("group:");
  const Icon = grouped ? Layers : objectIcons[block.type] ?? Layers;
  const label = grouped ? `Group ${index + 1} (${unit.blocks.length} objects)` : objectLabels[block.type] ?? block.type;
  const checked = selectedIds ? unit.blocks.every((item) => selectedIds.includes(item.id)) : unit.blocks.some((item) => selectedId === item.id);
  const reducedMotion = useReducedMotion();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: block.id, disabled: total < 2 || unit.locked || unit.hidden });
  return <div ref={setNodeRef} data-slide-layer={block.id} data-slide-layer-group={grouped ? block.slideGroupId : undefined} className={`relative min-w-0 rounded-md border p-1 ${checked ? "border-indigo-200 bg-indigo-50" : "border-slate-200 bg-white"} ${isDragging ? "z-30 opacity-70" : ""}`} style={{ transform: CSS.Transform.toString(transform), transition: reducedMotion ? undefined : transition }}>
    <div className="flex min-w-0 items-center gap-1">
      <Button data-slide-layer-reorder ref={setActivatorNodeRef} variant="ghost" size="icon" {...attributes} {...listeners} aria-label={`Reorder ${label.toLowerCase()} layer ${index + 1}`} title="Drag to reorder layer" disabled={total < 2 || unit.locked || unit.hidden} className="size-7 shrink-0 touch-none text-slate-500" style={{ cursor: isDragging ? "grabbing" : "grab" }}><GripVertical size={14} aria-hidden="true" /></Button>
      {onToggleSelect && <Checkbox aria-label={`Add ${grouped ? `group ${index + 1}` : block.type} to selection`} checked={checked} disabled={unit.locked || unit.hidden} onChange={() => onToggleSelect(block.id)} />}
      <Button variant="ghost" size="sm" onClick={(event) => onSelect(block.id, event)} aria-label={grouped ? `Select group ${index + 1} from layers` : `Select ${block.type} object from layers`} aria-pressed={checked} className="min-w-0 flex-1 justify-start gap-1 px-1"><Icon size={14} aria-hidden="true" className="shrink-0" /><span className="truncate capitalize">{grouped ? label : `${index + 1}. ${label}`}</span></Button>
      {grouped && <Button variant="ghost" size="icon" className="size-6 shrink-0" aria-label={`${expanded ? "Collapse" : "Expand"} group ${index + 1}`} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</Button>}
      {onToggleFlag && <>
        <Button variant="ghost" size="icon" className="size-6 shrink-0" aria-label={`${unit.locked ? "Unlock" : "Lock"} ${grouped ? `group ${index + 1}` : block.type} layer`} aria-pressed={unit.locked} onClick={() => onToggleFlag(block.id, "slideLocked")}>{unit.locked ? <Lock size={12} /> : <Unlock size={12} />}</Button>
        <Button variant="ghost" size="icon" className="size-6 shrink-0" aria-label={`${unit.hidden ? "Show" : "Hide"} ${grouped ? `group ${index + 1}` : block.type} in editor`} aria-pressed={unit.hidden} onClick={() => onToggleFlag(block.id, "slideHiddenInEditor")}>{unit.hidden ? <EyeOff size={12} /> : <Eye size={12} />}</Button>
      </>}
    </div>
    {grouped && expanded && <div className="ml-8 space-y-1 border-l border-slate-200 pl-2">{unit.blocks.map((member) => <Button key={member.id} variant="ghost" size="sm" disabled={unit.locked || unit.hidden} className="h-auto min-h-7 w-full justify-start px-1 text-xs capitalize" aria-label={`Edit ${member.type} in group`} onClick={() => onSelectMember?.(member.id)}>{objectLabels[member.type] ?? member.type}</Button>)}</div>}
  </div>;
}

export function SlideObjectLayers(props: Props) {
  const { blocks, onReorder } = props;
  const id = `slide-layers-${useId().replaceAll(":", "")}`;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const units = slideSelectionUnits(blocks);
  function reorder({ active, over }: DragEndEvent) { if (over && active.id !== over.id) onReorder(String(active.id), String(over.id)); }
  return <div className="space-y-2">
    <p className="text-[11px] text-slate-500">Front to back. Drag handles to reorder. Hidden layers still appear in preview and exports.</p>
    <DndContext id={id} sensors={sensors} collisionDetection={closestCenter} onDragEnd={reorder} accessibility={{ screenReaderInstructions: { draggable: "To reorder a layer, press Space or Enter on its handle, use the arrow keys to move it, and press Space or Enter to drop. Press Escape to cancel." } }}>
      <SortableContext items={units.map((unit) => unit.blocks[0].id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-1.5">{units.map((unit, index) => <Layer key={unit.id} {...props} unit={unit} index={index} total={units.length} />)}</div>
      </SortableContext>
    </DndContext>
  </div>;
}
