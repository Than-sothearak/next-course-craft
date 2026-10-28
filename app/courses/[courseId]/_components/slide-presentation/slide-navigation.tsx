"use client";

import Image from "next/image";
import { ArrowLeft, ArrowRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ContentBlock } from "@/lib/schemas/block";
import { cn } from "@/lib/utils";
import { defaultSlideMaster, resolveSlideFrame, type SlideCover, type SlideMaster } from "@/lib/editor/slide-design";

export type SlideItem = { id: string; title: string; blocks: readonly ContentBlock[]; slideCover?: SlideCover };

export function SlideThumbnail({ slide, index, master, courseTitle }: { slide: SlideItem; index: number; master?: SlideMaster; courseTitle?: string }) {
  const image = slide.blocks.find((block) => block.type === "image");
  const text = slide.blocks.find((block) => block.type === "richText");
  const design = master ?? defaultSlideMaster;
  if (slide.slideCover) return <span className="relative flex aspect-video flex-col items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-gradient-to-br from-indigo-950 to-sky-600 p-2 text-center text-white shadow-sm">
    {slide.slideCover.imageSrc && <Image src={slide.slideCover.imageSrc} alt="" fill unoptimized sizes="160px" className="object-cover" />}
    <span className="absolute inset-0 bg-slate-950/50" />
    {slide.slideCover.lessonOf && <span className="relative z-10 text-[7px] uppercase tracking-wider">{slide.slideCover.lessonOf}</span>}
    <span className="relative z-10 line-clamp-2 text-[11px] font-bold leading-tight">{courseTitle ?? slide.title}</span>
    {slide.slideCover.subtitle && <span className="relative z-10 mt-1 line-clamp-1 text-[7px]">{slide.slideCover.subtitle}</span>}
    <span className="absolute bottom-1 left-2 z-10 text-[9px] font-semibold">{index + 1}</span>
  </span>;
  return (
    <span className="relative flex aspect-video flex-col overflow-hidden rounded-md border border-slate-200 p-2 text-left shadow-sm" style={{ backgroundColor: design.backgroundColor, color: design.textColor }}>
      <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: design.accentColor }} />
      {image?.type === "image" && <Image src={image.data.src} alt="" fill unoptimized sizes="160px" className="object-cover opacity-15" />}
      <span className="relative z-10 line-clamp-2 text-[11px] font-bold leading-tight">{slide.title}</span>
      <span className="relative mt-1 min-h-0 flex-1">
        {slide.blocks.slice(0, 12).map((block, blockIndex) => {
          const frame = resolveSlideFrame(block, blockIndex, slide.blocks.length);
          return <span key={block.id} aria-hidden="true" className="absolute rounded-[2px] border border-current opacity-25" style={{ left: `${frame.x}%`, top: `${frame.y}%`, width: `${frame.width}%`, height: `${frame.height}%` }} />;
        })}
        {text?.type === "richText" && <span className="relative z-10 line-clamp-2 text-[8px] leading-tight opacity-70">{text.data.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}</span>}
      </span>
      <span className="relative z-10 text-[9px] font-semibold opacity-60">{index + 1}</span>
    </span>
  );
}

export function SlideNavigation({ slides, activeId, onSelect, onAdd, getLockMessage, appearance = "editor", master, courseTitle }: {
  slides: readonly SlideItem[];
  activeId: string;
  onSelect: (id: string) => void;
  onAdd?: () => void;
  getLockMessage?: (id: string) => string | null;
  appearance?: "editor" | "presentation";
  master?: SlideMaster;
  courseTitle?: string;
}) {
  const index = slides.findIndex((slide) => slide.id === activeId);
  const previous = slides[index - 1];
  const next = slides[index + 1];
  const nextLock = next ? getLockMessage?.(next.id) : null;
  return (
    <nav aria-label="Slide navigation" className={cn("w-full shrink-0 border-t px-4 py-3", appearance === "presentation" ? "border-white/10 bg-slate-900 text-white" : "border-slate-200 bg-white")}>
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
        <Button type="button" variant="outline" size="sm" disabled={!previous} onClick={() => previous && onSelect(previous.id)} className={appearance === "presentation" ? "border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white" : undefined}><ArrowLeft size={15} /> Previous</Button>
        <span className={cn("text-xs font-semibold", appearance === "presentation" ? "text-slate-300" : "text-slate-600")}>Slide {index + 1} of {slides.length}</span>
        <Button type="button" variant="outline" size="sm" disabled={!next || Boolean(nextLock)} title={nextLock ?? undefined} onClick={() => next && onSelect(next.id)} className={appearance === "presentation" ? "border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white" : undefined}>Next <ArrowRight size={15} /></Button>
      </div>
      <div className="mx-auto mt-3 flex max-w-5xl gap-2 overflow-x-auto pb-1" aria-label="Slide thumbnails">
        {slides.map((slide, slideIndex) => {
          const lock = getLockMessage?.(slide.id);
          return <Button key={slide.id} type="button" variant="ghost" aria-label={`Go to slide ${slideIndex + 1}: ${slide.title}`} aria-current={slide.id === activeId ? "step" : undefined} disabled={Boolean(lock)} title={lock ?? slide.title} onClick={() => onSelect(slide.id)} className={cn("h-auto w-36 shrink-0 flex-col items-stretch justify-start rounded-lg p-1 text-left ring-indigo-500 focus-visible:ring-2 aria-[current=step]:ring-2", appearance === "presentation" ? "hover:bg-white/10 aria-[current=step]:bg-indigo-400/20" : "hover:bg-indigo-50 aria-[current=step]:bg-indigo-50")}>
            <SlideThumbnail slide={slide} index={slideIndex} master={master} courseTitle={courseTitle} />
          </Button>;
        })}
        {onAdd && <Button type="button" variant="outline" onClick={onAdd} className="h-auto w-36 shrink-0 flex-col gap-1 rounded-lg border-dashed"><Plus size={18} />Add slide</Button>}
      </div>
    </nav>
  );
}
