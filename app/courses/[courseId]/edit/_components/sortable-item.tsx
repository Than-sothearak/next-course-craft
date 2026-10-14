"use client";

import type { ReactNode } from "react";
import { GripVertical } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export function SortableItem({ id, children, className = "", contentClassName = "", handleClassName = "", overlayHandle = false, alwaysShowHandle = false, centerHandle = false, animateLayout = false }: { id: string; children: ReactNode; className?: string; contentClassName?: string; handleClassName?: string; overlayHandle?: boolean; alwaysShowHandle?: boolean; centerHandle?: boolean; animateLayout?: boolean; exit?: boolean }) {
  const prefersReducedMotion = useReducedMotion();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, transition: { duration: prefersReducedMotion ? 0 : 380, easing: "cubic-bezier(0.22, 1, 0.36, 1)" } });
  const content = animateLayout
    ? <motion.div layout={prefersReducedMotion ? false : "position"} initial={prefersReducedMotion ? false : { opacity: 0, y: 10, scale: 0.99 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -8, scale: 0.98, pointerEvents: "none" }} transition={{ duration: prefersReducedMotion ? 0 : 0.38, ease: [0.22, 1, 0.36, 1] }} className={`sortable-item-layout-transition min-w-0 w-full ${contentClassName}`}>{children}</motion.div>
    : <div className={`min-w-0 w-full ${contentClassName}`}>{children}</div>;
  return <div className="w-full">
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`group ${className} ${isDragging ? "z-10 opacity-60" : ""}`}>
    {overlayHandle ? <>
      <button ref={setActivatorNodeRef} type="button" aria-label="Drag to reorder" className={`absolute -left-7 ${centerHandle ? "top-1/2 -translate-y-1/2" : "top-0"} z-20 grid size-7 touch-none cursor-grab place-items-center rounded text-slate-400 transition-opacity hover:bg-slate-100 hover:text-slate-700 active:cursor-grabbing ${handleClassName} ${alwaysShowHandle ? "opacity-100" : "opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"}`} {...attributes} {...listeners}><GripVertical size={15} aria-hidden="true" /></button>
      {content}
    </> : <div className="flex min-w-0 items-center gap-1">
      <button ref={setActivatorNodeRef} type="button" aria-label="Drag to reorder" className={`grid size-7 shrink-0 touch-none cursor-grab place-items-center rounded text-slate-400 transition-opacity hover:bg-slate-100 hover:text-slate-700 active:cursor-grabbing ${handleClassName} ${alwaysShowHandle ? "opacity-100" : "opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"}`} {...attributes} {...listeners}><GripVertical size={15} aria-hidden="true" /></button>
      {animateLayout ? content : children}
    </div>}
    </div>
  </div>;
}
