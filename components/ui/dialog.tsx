"use client";

import { useEffect, useId, useRef, type CSSProperties, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

export function Dialog({ open, onClose, title, children, footer, busy = false, className, style }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; busy?: boolean; className?: string; style?: CSSProperties }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);
  return <dialog ref={ref} aria-labelledby={titleId} style={style} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }} onClick={(event) => { if (!busy && event.target === event.currentTarget) onClose(); }} className={cn("fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto rounded-2xl border border-slate-200 p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/40", className)}>
    <div className="p-6"><div className="mb-5 flex items-center justify-between gap-4"><h2 id={titleId} className="text-xl font-semibold">{title}</h2><Button variant="ghost" size="icon" disabled={busy} onClick={onClose} aria-label="Close dialog"><X size={18} /></Button></div>{children}{footer && <div className="mt-6 flex justify-end gap-3">{footer}</div>}</div>
  </dialog>;
}
