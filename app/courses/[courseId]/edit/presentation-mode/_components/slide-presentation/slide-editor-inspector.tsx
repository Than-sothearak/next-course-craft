"use client";

import type { ReactNode, Ref } from "react";

export function SlideEditorInspector({
  inspectorRef,
  children,
}: {
  inspectorRef?: Ref<HTMLElement>;
  children: ReactNode;
}) {
  return (
    <aside
      ref={inspectorRef}
      className="h-full max-h-[calc(100dvh-120px)] min-h-0 min-w-0 space-y-3 overflow-y-auto overscroll-contain"
      aria-label="Slide inspector"
    >
      {children}
    </aside>
  );
}
