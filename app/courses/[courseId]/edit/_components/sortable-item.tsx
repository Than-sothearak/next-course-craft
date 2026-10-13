"use client";

import type { ReactNode } from "react";
import { GripVertical } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export function SortableItem({ id, children, className = "", contentClassName = "", handleClassName = "", overlayHandle = false, alwaysShowHandle = false, centerHandle = false }: { id: string; children: ReactNode; className?: string; contentClassName?: string; handleClassName?: string; overlayHandle?: boolean; alwaysShowHandle?: boolean; centerHandle?: boolean }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, transition: { duration: 280, easing: "cubic-bezier(0.22, 1, 0.36, 1)" } });
  return <div className="w-full">
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`group ${className} ${isDragging ? "z-10 opacity-60" : ""}`}>
    {overlayHandle ? <>
      <button ref={setActivatorNodeRef} type="button" aria-label="Drag to reorder" className={`absolute -left-7 ${centerHandle ? "top-1/2 -translate-y-1/2" : "top-0"} z-20 grid size-7 touch-none cursor-grab place-items-center rounded text-slate-400 transition-opacity hover:bg-slate-100 hover:text-slate-700 active:cursor-grabbing ${handleClassName} ${alwaysShowHandle ? "opacity-100" : "opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"}`} {...attributes} {...listeners}><GripVertical size={15} aria-hidden="true" /></button>
      <div className={`min-w-0 w-full ${contentClassName}`}>{children}</div>
    </> : <div className="flex min-w-0 items-center gap-1">
      <button ref={setActivatorNodeRef} type="button" aria-label="Drag to reorder" className={`grid size-7 shrink-0 touch-none cursor-grab place-items-center rounded text-slate-400 transition-opacity hover:bg-slate-100 hover:text-slate-700 active:cursor-grabbing ${handleClassName} ${alwaysShowHandle ? "opacity-100" : "opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"}`} {...attributes} {...listeners}><GripVertical size={15} aria-hidden="true" /></button>
      {children}
    </div>}
    </div>
  </div>;
}
