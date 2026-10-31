"use client";

import { useId } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useReducedMotion } from "framer-motion";
import { Copy, GripVertical, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SlideThumbnail, type SlideItem } from "@/app/courses/[courseId]/_components/slide-presentation/slide-navigation";
import { slideNavigationLabel, type SlideMaster } from "@/lib/editor/slide-design";

type Props = {
  slides: readonly SlideItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onAddQuiz?: () => void;
  onDuplicate?: (id: string) => void;
  onDelete: (id: string) => void;
  onReorder?: (activeId: string, overId: string) => void;
  master?: SlideMaster;
  courseTitle?: string;
};

function SortableSlide({ slide, index, total, activeId, onSelect, onDuplicate, onDelete, master, courseTitle, reorderable }: Pick<Props, "activeId" | "onSelect" | "onDuplicate" | "onDelete" | "master" | "courseTitle"> & { slide: SlideItem; index: number; total: number; reorderable: boolean }) {
  const reducedMotion = useReducedMotion();
  const label = slideNavigationLabel(slide.title, index);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: slide.id, disabled: !reorderable || total < 2, data: { title: label } });
  return <div ref={setNodeRef} data-sortable-slide={slide.id} className={`relative w-36 shrink-0 lg:w-full ${reorderable ? "[&_[data-slide-thumbnail-label]]:pl-10" : ""} ${isDragging ? "z-30 opacity-70" : ""}`} style={{ transform: CSS.Transform.toString(transform), transition: reducedMotion ? undefined : transition }}>
    <SlideThumbnail slide={slide} index={index} total={total} master={master} courseTitle={courseTitle} />
    <Button type="button" variant="ghost" aria-label={`Edit slide ${index + 1}: ${label}`} aria-current={slide.id === activeId ? "step" : undefined} onClick={() => onSelect(slide.id)} className="absolute inset-0 z-10 h-full w-full rounded-none border-2 border-transparent bg-transparent p-0 ring-indigo-500 hover:bg-indigo-50/20 aria-[current=step]:border-indigo-500 focus-visible:ring-2" />
    {reorderable && <Button ref={setActivatorNodeRef} type="button" variant="ghost" size="icon" {...attributes} {...listeners} aria-label={`Reorder slide ${index + 1}: ${label}`} title="Drag to reorder slide" disabled={total < 2} className="absolute bottom-2 left-2 z-20 size-7 touch-none bg-white/95 text-slate-500 hover:bg-white hover:text-indigo-600" style={{ cursor: isDragging ? "grabbing" : "grab" }}><GripVertical size={15} aria-hidden="true" /></Button>}
    {onDuplicate && <Button type="button" variant="outline" size="icon" aria-label={`Duplicate slide ${index + 1}: ${label}`} title="Duplicate slide" onClick={() => onDuplicate(slide.id)} className="absolute bottom-2 right-11 z-20 size-7 bg-white text-slate-600 hover:bg-slate-50 hover:text-indigo-700"><Copy size={14} /></Button>}
    <Button type="button" variant="outline" size="icon" aria-label={`Delete slide ${index + 1}: ${label}`} title="Delete slide" onClick={() => onDelete(slide.id)} className="absolute bottom-2 right-2 z-20 size-7 bg-white text-rose-600 hover:bg-rose-50 hover:text-rose-700"><Trash2 size={14} /></Button>
  </div>;
}

export function SlideEditorSidebar({ slides, activeId, onSelect, onAdd, onAddQuiz, onDuplicate, onDelete, onReorder, master, courseTitle }: Props) {
  const dndId = `slide-thumbnails-${useId().replaceAll(":", "")}`;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  function reorder(event: DragEndEvent) {
    if (event.over && event.active.id !== event.over.id && slides.some((slide) => slide.id === event.active.id) && slides.some((slide) => slide.id === event.over?.id)) onReorder?.(String(event.active.id), String(event.over.id));
  }
  return (
    <aside aria-label="Slide thumbnails" className="min-w-0 self-start rounded-xl border border-slate-200 bg-slate-100 p-3 lg:sticky lg:top-[84px] lg:max-h-[calc(100dvh-100px)] lg:min-h-[340px] lg:overflow-y-auto">
      <div className="mb-3 flex items-center justify-between px-1 text-xs font-semibold text-slate-600">
        <span>Slides</span><span>{slides.length}</span>
      </div>
      <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={reorder} accessibility={{ screenReaderInstructions: { draggable: "To reorder a slide, press Space or Enter on its handle, use the arrow keys to move it, and press Space or Enter to drop. Press Escape to cancel." } }}>
        <SortableContext items={slides.map((slide) => slide.id)} strategy={rectSortingStrategy}>
          <div className="flex gap-2 overflow-x-auto p-1 lg:block lg:space-y-2 lg:overflow-x-visible">
            {slides.map((slide, index) => <SortableSlide key={slide.id} slide={slide} index={index} total={slides.length} activeId={activeId} master={master} courseTitle={courseTitle} onSelect={onSelect} onDuplicate={onDuplicate} onDelete={onDelete} reorderable={Boolean(onReorder)} />)}
          </div>
        </SortableContext>
      </DndContext>
      {!slides.length && <p className="py-4 text-center text-xs text-slate-500">No slides yet</p>}
      {onReorder && slides.length > 1 && <p className="mt-2 px-1 text-[11px] text-slate-500">Drag the handles to reorder slides.</p>}
      <div className={`mt-3 grid gap-2 ${onAddQuiz ? "grid-cols-2" : "grid-cols-1"}`}><Button type="button" variant="outline" size="sm" onClick={onAdd} className="border-dashed"><Plus size={15} />Add slide</Button>{onAddQuiz && <Button type="button" variant="outline" size="sm" onClick={onAddQuiz} className="border-dashed"><Plus size={15} />Quiz slide</Button>}</div>
    </aside>
  );
}
