"use client";
import { useRef, useState, type PointerEvent } from "react";
import type { Editor } from "@tiptap/react";
import { Move } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ContentBlock } from "@/lib/schemas/block";
import { fitSlideMediaFrame, resolveSlideFrame, resolveSlideObjectArea, slideMediaSchema, type SlideFrame, type SlideMaster, type SlideSize } from "@/lib/editor/slide-design";
import { isSlideMediaObject, resizeSlideObjectFrame, resolveSlideMedia, snapSlideFrameToFooter } from "@/lib/editor/slide-objects";
import { croppedDimensions, resolveSlideCrop } from "@/lib/editor/slide-crop";
import { ContentBlockPreview } from "../(editor_client_components)/(content_block_editor_components)/_components/content-block-preview";
import { PreviewBlock } from "../../../preview/_components/(course_preview_components)/(lesson_reader_preview_components)/(lesson_blocks_preview_components)/preview-block";
import { slideObjectSurfaceStyle } from "../../../preview/_components/(course_preview_components)/preview-utils";
import { SlideMediaObject } from "../../../_components/slide-presentation/slide-media-object";
import { SlideObjectContent } from "../../../_components/slide-presentation/slide-object-content";
import { isSlideTextBlock, SlideTextObjectEditor } from "./slide-text-object-editor";

export function SlideObject({ block, index, total, master, area: customArea, lessonBlocks = [], selected, onSelect, onFrame, onChange, onEditorFocus, onFooterSnap }: {
  block: ContentBlock;
  index: number;
  total: number;
  master?: SlideMaster;
  area?: SlideSize;
  lessonBlocks?: ContentBlock[];
  selected: boolean;
  onSelect: () => void;
  onFrame: (frame: SlideFrame) => void;
  onChange: (block: ContentBlock) => void;
  onEditorFocus: (editor: Editor) => void;
  onFooterSnap: (snapped: boolean) => void;
}) {
  const area = customArea ?? resolveSlideObjectArea(master);
  const savedFrame = resolveSlideFrame(block, index, total, area);
  const editableText = isSlideTextBlock(block);
  const editableInteractive = block.type === "labeledGraphic" || block.type === "interactionButton" || block.type === "audioInstruction";
  const [draftFrame, setDraftFrame] = useState<SlideFrame | null>(null);
  const draftFrameRef = useRef<SlideFrame | null>(null);
  const frame = draftFrame ?? savedFrame;
  const drag = useRef<{ pointerId: number; kind: "move" | "resize"; startX: number; startY: number; frame: SlideFrame; bounds: DOMRect } | null>(null);

  function start(event: PointerEvent<HTMLElement>, kind: "move" | "resize", fromHandle = false) {
    if (event.button !== 0) return;
    if (kind === "move" && !fromHandle && (event.target as HTMLElement).closest("button, a, input, textarea, select, [contenteditable='true']")) return;
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
    const horizontalScale = deltaX / current.frame.width;
    const verticalScale = deltaY / current.frame.height;
    const scale = 1 + (Math.abs(horizontalScale) >= Math.abs(verticalScale) ? horizontalScale : verticalScale);
    let next = resizeSlideObjectFrame(block, current.frame, current.kind === "move"
      ? { x: current.frame.x + deltaX, y: current.frame.y + deltaY }
      : isSlideMediaObject(block) ? { width: current.frame.width * scale }
        : { width: current.frame.width + deltaX, height: current.frame.height + deltaY }, area);
    if (current.kind === "move") {
      const snap = snapSlideFrameToFooter(next, current.bounds.height);
      next = snap.frame;
      onFooterSnap(snap.snapped);
    }
    draftFrameRef.current = next;
    setDraftFrame(next);
  }
  function stop(event: PointerEvent<HTMLElement>) {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    onFooterSnap(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (draftFrameRef.current) onFrame(draftFrameRef.current);
    draftFrameRef.current = null;
    setDraftFrame(null);
  }

  function recordMediaDimensions(dimensions: { width: number; height: number }) {
    if (!isSlideMediaObject(block)) return;
    const parsed = slideMediaSchema.safeParse({ source: block.data.src, ...dimensions });
    if (!parsed.success) return;
    const previous = resolveSlideMedia(block);
    if (previous?.width === dimensions.width && previous.height === dimensions.height) return;
    onChange({ ...block, slideMedia: parsed.data, slideFrame: fitSlideMediaFrame(savedFrame, croppedDimensions(parsed.data, resolveSlideCrop(block)), { width: savedFrame.width }, area) });
  }

  return (
    <div data-slide-object-frame data-slide-object-id={block.id} onFocusCapture={onSelect} onPointerDownCapture={(event) => { if (event.button === 0) onSelect(); }} onPointerDown={(event) => start(event, "move")} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} onDragStart={(event) => event.preventDefault()} className={`pointer-events-auto absolute overflow-hidden rounded-md border-2 ${editableText || editableInteractive ? "touch-auto" : "touch-none"} ${selected ? "cursor-grab border-indigo-500 shadow-lg active:cursor-grabbing" : "cursor-grab border-transparent hover:border-indigo-300"}`} style={{ left: `${frame.x}%`, top: `${frame.y}%`, width: `${frame.width}%`, height: `${frame.height}%`, zIndex: selected ? 1000 : frame.z + 1, ...slideObjectSurfaceStyle(block, master?.backgroundColor, master?.textColor) }}>
      <div className={`h-full ${editableText ? "cursor-text" : editableInteractive ? "cursor-default" : "pointer-events-none"}`}>
        <SlideObjectContent media={isSlideMediaObject(block)}>
        {isSlideTextBlock(block) ? <SlideTextObjectEditor block={block} onChange={onChange} onEditorFocus={onEditorFocus} /> : block.type === "labeledGraphic" ? <ContentBlockPreview block={block} onChange={onChange} presentation /> : isSlideMediaObject(block) ? <SlideMediaObject key={block.data.src} block={block} onDimensions={recordMediaDimensions} /> : <PreviewBlock block={block} authoring lessonBlocks={lessonBlocks} slideLayout device="desktop" orientation="landscape" />}
        </SlideObjectContent>
      </div>
      {selected && <>
        <Button type="button" variant="outline" size="icon" aria-label={`Move ${block.type} object`} title="Drag to move object" onPointerDown={(event) => { event.stopPropagation(); start(event, "move", true); }} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} className="absolute right-0 top-0 z-20 size-6 cursor-grab touch-none rounded-none rounded-bl border-0 bg-white text-indigo-700 active:cursor-grabbing"><Move size={14} /></Button>
        <Button type="button" size="icon" aria-label={`Resize ${block.type} object`} onPointerDown={(event) => { event.stopPropagation(); start(event, "resize"); }} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} className="absolute bottom-0 right-0 z-20 size-5 cursor-nwse-resize touch-none rounded-none rounded-tl bg-indigo-600" />
      </>}
    </div>
  );
}

