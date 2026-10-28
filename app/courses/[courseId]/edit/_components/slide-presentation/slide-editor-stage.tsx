"use client";

import type { ReactNode } from "react";
import { Presentation } from "lucide-react";
import { SlideStage } from "@/app/courses/[courseId]/_components/slide-presentation/slide-stage";

export function SlideEditorStage({ active, title, children }: { active: boolean; title: string; children: ReactNode }) {
  if (!active) return <>{children}</>;
  return (
    <section aria-label="Presentation slide editor" className="overflow-hidden rounded-xl border border-slate-700 bg-slate-800 shadow-lg">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 bg-slate-900 px-4 py-2.5 text-xs text-slate-200">
        <span className="flex min-w-0 items-center gap-2 font-semibold"><Presentation size={15} className="shrink-0" /><span className="truncate">{title}</span></span>
        <span className="shrink-0 text-slate-400">16:9 widescreen · 960 × 540</span>
      </header>
      <SlideStage className="h-[min(720px,calc(100dvh-210px))] min-h-[340px] bg-slate-800" canvasClassName="border border-white/20">
        {children}
      </SlideStage>
    </section>
  );
}
