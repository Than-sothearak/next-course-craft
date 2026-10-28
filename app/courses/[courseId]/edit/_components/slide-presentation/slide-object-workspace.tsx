"use client";

import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SlideStage } from "@/app/courses/[courseId]/_components/slide-presentation/slide-stage";
import { SlideSurface } from "@/app/courses/[courseId]/_components/slide-presentation/slide-surface";
import { SlideCoverSurface } from "@/app/courses/[courseId]/_components/slide-presentation/slide-cover-surface";
import { resolveSlideFrame, type SlideCover, type SlideFrame, type SlideMaster } from "@/lib/editor/slide-design";
import type { ContentBlock } from "@/lib/schemas/block";
import { ContentBlockEditor } from "../(editor_client_components)/content-block-editor";
import { PreviewBlock } from "@/app/courses/[courseId]/preview/_components/(course_preview_components)/(lesson_reader_preview_components)/(lesson_blocks_preview_components)/preview-block";
import { SlideMasterPanel } from "./slide-master-panel";
import { SlideMediaPicker } from "./slide-media-picker";
import { SlideCoverEditor } from "./slide-cover-editor";

const objectTemplates = [
  { id: "text-subheading", label: "Heading" },
  { id: "text-paragraph", label: "Text" },
  { id: "image-single", label: "Image" },
  { id: "gallery-three", label: "Gallery" },
  { id: "media-video", label: "Video" },
  { id: "media-audio", label: "Audio" },
  { id: "media-attachment", label: "File" },
  { id: "interactive-reveal", label: "Flip cards" },
  { id: "interactive-labeled-graphic", label: "Interactive image" },
  { id: "interactive-knowledge-check", label: "Question" },
  { id: "chart-bars", label: "Chart" },
] as const;

function fitFrame(frame: SlideFrame, update: Partial<SlideFrame>): SlideFrame {
  let width = Math.max(5, Math.min(100, update.width ?? frame.width));
  let height = Math.max(5, Math.min(100, update.height ?? frame.height));
  let x = Math.max(0, Math.min(95, update.x ?? frame.x));
  let y = Math.max(0, Math.min(95, update.y ?? frame.y));
  if (update.width !== undefined && update.x === undefined) width = Math.min(width, 100 - x);
  else x = Math.min(x, 100 - width);
  if (update.height !== undefined && update.y === undefined) height = Math.min(height, 100 - y);
  else y = Math.min(y, 100 - height);
  return {
    x,
    y,
    width, height,
    z: Math.max(0, Math.min(500, Math.round(update.z ?? frame.z))),
  };
}

function SlideObject({ block, index, total, master, selected, onSelect, onFrame }: {
  block: ContentBlock;
  index: number;
  total: number;
  master?: SlideMaster;
  selected: boolean;
  onSelect: () => void;
  onFrame: (frame: SlideFrame) => void;
}) {
  const savedFrame = resolveSlideFrame(block, index, total);
  const textObject = block.type === "heading" || block.type === "richText";
  const displayBackground = textObject ? master?.backgroundColor ?? "#ffffff" : block.backgroundColor;
  const [draftFrame, setDraftFrame] = useState<SlideFrame | null>(null);
  const draftFrameRef = useRef<SlideFrame | null>(null);
  const frame = draftFrame ?? savedFrame;
  const drag = useRef<{ pointerId: number; kind: "move" | "resize"; startX: number; startY: number; frame: SlideFrame; bounds: DOMRect } | null>(null);

  function start(event: PointerEvent<HTMLElement>, kind: "move" | "resize") {
    if (event.button !== 0) return;
    if (kind === "move" && (event.target as HTMLElement).closest("button, a, input, textarea, select, [contenteditable='true']")) return;
    const bounds = event.currentTarget.closest<HTMLElement>("[data-slide-objects]")?.getBoundingClientRect();
    if (!bounds?.width || !bounds.height) return;
    onSelect();
    drag.current = { pointerId: event.pointerId, kind, startX: event.clientX, startY: event.clientY, frame, bounds };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }
  function move(event: PointerEvent<HTMLElement>) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const deltaX = (event.clientX - current.startX) / current.bounds.width * 100;
    const deltaY = (event.clientY - current.startY) / current.bounds.height * 100;
    const next = fitFrame(current.frame, current.kind === "move"
      ? { x: current.frame.x + deltaX, y: current.frame.y + deltaY }
      : { width: current.frame.width + deltaX, height: current.frame.height + deltaY });
    draftFrameRef.current = next;
    setDraftFrame(next);
  }
  function stop(event: PointerEvent<HTMLElement>) {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (draftFrameRef.current) onFrame(draftFrameRef.current);
    draftFrameRef.current = null;
    setDraftFrame(null);
  }

  return (
    <div data-slide-object-id={block.id} onPointerDown={(event) => start(event, "move")} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} onDragStart={(event) => event.preventDefault()} className={`absolute touch-none overflow-hidden rounded-md border-2 ${selected ? "cursor-grab border-indigo-500 shadow-lg active:cursor-grabbing" : "cursor-grab border-transparent hover:border-indigo-300"}`} style={{ left: `${frame.x}%`, top: `${frame.y}%`, width: `${frame.width}%`, height: `${frame.height}%`, zIndex: selected ? 1000 : frame.z + 1, backgroundColor: displayBackground }}>
      <div className="pointer-events-none h-full overflow-auto"><PreviewBlock block={{ ...block, blockPadding: Math.min(block.blockPadding, 12), backgroundColor: displayBackground }} device="desktop" orientation="landscape" /></div>
      {selected && <button type="button" aria-label={`Resize ${block.type} object`} onPointerDown={(event) => { event.stopPropagation(); start(event, "resize"); }} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} className="absolute bottom-0 right-0 z-20 size-5 cursor-nwse-resize touch-none rounded-tl bg-indigo-600" />}
    </div>
  );
}

export function SlideObjectWorkspace({ title, courseTitle, slideNumber, slideCount, blocks, sections, lessons, master, cover, courseId, onTitleChange, onMasterChange, onCoverChange, onApplyCover, onCourseTitleChange, onStart, onBlockChange, onAddTemplate, onMoreTemplates, onReplaceTemplate, onDuplicate, onDelete, children }: {
  title: string;
  courseTitle: string;
  slideNumber: number;
  slideCount: number;
  blocks: ContentBlock[];
  sections: { id: string; title: string; order: number }[];
  lessons: { id: string; title: string; sectionId: string; order: number; lessonType?: "content" | "quiz" }[];
  master?: SlideMaster;
  cover?: SlideCover;
  courseId: string;
  onTitleChange: (title: string) => void;
  onMasterChange: (master: SlideMaster) => void;
  onCoverChange: (cover?: SlideCover) => void;
  onApplyCover: () => void;
  onCourseTitleChange: (title: string) => void;
  onStart?: () => void;
  onBlockChange: (block: ContentBlock) => void;
  onAddTemplate: (id: string) => string | null;
  onMoreTemplates: () => void;
  onReplaceTemplate: (block: ContentBlock) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  children?: ReactNode;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = blocks.find((block) => block.id === selectedId) ?? null;
  return (
    <div className="space-y-3" aria-label="Presentation slide editor">
      <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-white p-2" aria-label="Slide object templates">
        {slideNumber === 1 && !cover && <Button type="button" variant="outline" size="sm" onClick={onApplyCover}>Image cover slide</Button>}
        {!cover && <>
        {objectTemplates.map((template) => <Button key={template.id} type="button" variant="ghost" size="sm" onClick={() => { const id = onAddTemplate(template.id); if (id) setSelectedId(id); }}><Plus size={13} />{template.label}</Button>)}
        <Button type="button" variant="outline" size="sm" onClick={onMoreTemplates}>More blocks</Button>
        </>}
      </div>
      <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_280px]">
        <section className="min-w-0 overflow-hidden rounded-xl border border-slate-700 bg-slate-900">
          <div className="flex items-center justify-between px-4 py-2 text-xs text-slate-300"><span>Slide {slideNumber} / {slideCount}</span><span>960 × 540 · 16:9</span></div>
          <SlideStage fillWidth className="aspect-video w-full min-h-[340px] bg-slate-800" canvasClassName="border border-white/20">
            {cover ? <SlideCoverSurface cover={cover} title={courseTitle} onStart={onStart} startDisabled={!onStart} /> : <SlideSurface master={master} title={<Input aria-label="Slide title" value={title} onChange={(event) => onTitleChange(event.target.value)} style={{ color: "inherit" }} className="h-auto w-full border-0 bg-transparent px-0 py-0 text-[32px] font-bold leading-tight shadow-none outline-none focus-visible:ring-0 placeholder:opacity-50" placeholder="Slide title" />} number={slideNumber} total={slideCount}>
              <div data-slide-objects className="relative h-full w-full">
                {blocks.map((block, index) => <SlideObject key={block.id} block={block} index={index} total={blocks.length} master={master} selected={selectedId === block.id} onSelect={() => setSelectedId(block.id)} onFrame={(slideFrame) => onBlockChange({ ...block, slideFrame })} />)}
              </div>
            </SlideSurface>}
          </SlideStage>
        </section>
        <aside className="max-h-[760px] space-y-3 overflow-y-auto" aria-label="Slide inspector">
          {cover ? <><label className="block rounded-xl border border-slate-200 bg-white p-4 text-xs font-medium text-slate-600">Course title<Input value={courseTitle} maxLength={160} onChange={(event) => onCourseTitleChange(event.target.value)} className="mt-1" /></label><SlideCoverEditor cover={cover} courseId={courseId} onChange={onCoverChange} onRemove={() => onCoverChange(undefined)} /></> : <SlideMasterPanel value={master} onChange={onMasterChange} />}
          {!cover && blocks.length > 0 && <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-4" aria-label="Slide object layers"><h2 className="text-sm font-semibold">Objects</h2><div className="flex flex-wrap gap-1">{[...blocks].sort((a, b) => resolveSlideFrame(b, blocks.indexOf(b), blocks.length).z - resolveSlideFrame(a, blocks.indexOf(a), blocks.length).z).map((block, index) => <Button key={block.id} type="button" variant={selectedId === block.id ? "secondary" : "outline"} size="sm" onClick={() => setSelectedId(block.id)} className="max-w-full truncate" aria-label={`Select ${block.type} object from layers`}>{index + 1}. {block.type}</Button>)}</div></section>}
          {!cover && selected && <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold capitalize">{selected.type} object</h2><div className="flex gap-1"><Button type="button" variant="ghost" size="icon" aria-label="Duplicate object" onClick={() => onDuplicate(selected.id)}><Copy size={14} /></Button><Button type="button" variant="ghost" size="icon" aria-label="Delete object" onClick={() => { onDelete(selected.id); setSelectedId(null); }}><Trash2 size={14} /></Button></div></div>
            <div className="grid grid-cols-2 gap-2">{(["x", "y", "width", "height"] as const).map((field) => <label key={field} className="text-xs text-slate-600">{field === "x" ? "Left" : field === "y" ? "Top" : field === "width" ? "Width" : "Height"} %<Input type="number" min={field === "width" || field === "height" ? 5 : 0} max={100} value={resolveSlideFrame(selected, blocks.indexOf(selected), blocks.length)[field]} onChange={(event) => { const value = Number(event.target.value); if (!Number.isFinite(value)) return; const current = resolveSlideFrame(selected, blocks.indexOf(selected), blocks.length); onBlockChange({ ...selected, slideFrame: fitFrame(current, { [field]: value }) }); }} className="mt-1 h-8" /></label>)}</div>
            <div className="flex gap-2"><Button type="button" variant="outline" size="sm" onClick={() => onBlockChange({ ...selected, slideFrame: fitFrame(resolveSlideFrame(selected, blocks.indexOf(selected), blocks.length), { z: Math.max(0, resolveSlideFrame(selected, blocks.indexOf(selected), blocks.length).z - 1) }) })}><ArrowDown size={14} />Back</Button><Button type="button" variant="outline" size="sm" onClick={() => onBlockChange({ ...selected, slideFrame: fitFrame(resolveSlideFrame(selected, blocks.indexOf(selected), blocks.length), { z: resolveSlideFrame(selected, blocks.indexOf(selected), blocks.length).z + 1 }) })}><ArrowUp size={14} />Front</Button></div>
            <SlideMediaPicker key={`media-${selected.id}`} block={selected} courseId={courseId} onChange={onBlockChange} />
            <div className="border-t pt-3"><ContentBlockEditor key={selected.id} block={selected} courseId={courseId} sections={sections} lessons={lessons} onChange={onBlockChange} onReplaceTemplate={() => onReplaceTemplate(selected)} inlineSettings /></div>
          </section>}
        </aside>
      </div>
      {children}
    </div>
  );
}
