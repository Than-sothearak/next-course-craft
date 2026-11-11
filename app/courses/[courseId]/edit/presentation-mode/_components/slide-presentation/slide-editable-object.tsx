"use client";
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { Editor } from "@tiptap/react";
import type { ContentBlock } from "@/lib/schemas/block";
import { defaultSlideFrame, fitSlideFrame, fitSlideMediaFrame, fitSlideTextFrame, resolveSlideFrame, resolveSlideObjectArea, resolveSlideTextLayout, slideFrameStyle, slideMediaSchema, type SlideFrame, type SlideMaster, type SlideSize } from "@/lib/editor/slide-design";
import { isSlideMediaObject, resolveSlideMedia } from "@/lib/editor/slide-objects";
import { hasProcessStepMedia } from "@/lib/editor/process-steps";
import { snapSlideObjectFrame, type SlideSnapGuide } from "@/lib/editor/slide-alignment";
import { normalizeSlideRotation, resizeSlideFrameFromHandle, rotateSlideFrame, type SlideResizeHandle } from "@/lib/editor/slide-transform";
import { SlideObjectTransformHandles, type SlideTransformKind } from "./slide-object-transform-handles";
import { croppedDimensions, resolveSlideCrop } from "@/lib/editor/slide-crop";
import { ContentBlockPreview } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(content_block_editor_components)/_components/content-block-preview";
import { PreviewBlock } from "@/app/courses/[courseId]/preview/_components/(course_preview_components)/(lesson_reader_preview_components)/(lesson_blocks_preview_components)/preview-block";
import { slideObjectSurfaceStyle } from "@/app/courses/[courseId]/preview/_components/(course_preview_components)/preview-utils";
import { SlideMediaObject } from "@/app/courses/[courseId]/_components/slide-presentation/slide-media-object";
import { SlideObjectContent } from "@/app/courses/[courseId]/_components/slide-presentation/slide-object-content";
import { isSlideTextBlock, SlideTextObjectEditor } from "./slide-text-object-editor";
import { useSlideObjectAnimation } from "@/app/courses/[courseId]/_components/slide-presentation/use-slide-object-animation";
import { AudioInstruction } from "@/app/courses/[courseId]/_components/slide-presentation/audio-instruction";
import { defaultAudioInstructionGuide } from "@/lib/editor/audio-instruction-guide";
import { minimumSlideAudioHeight } from "@/lib/editor/slide-design";
import { SlideFlipCardEditor } from "./slide-flip-card-editor";
import { AccordionBlockEditor } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(content_block_editor_components)/accordion-block-editor";
import { ProcessStepsBlockEditor } from "@/app/courses/[courseId]/edit/_components/(editor_client_components)/(content_block_editor_components)/process-steps-block-editor";

function measureTextBox(textBox: HTMLElement, maxWidth: number) {
  const clone = textBox.cloneNode(true) as HTMLElement;
  clone.style.position = "fixed";
  clone.style.left = "-100000px";
  clone.style.top = "0";
  clone.style.width = "max-content";
  clone.style.minWidth = "0";
  clone.style.maxWidth = `${maxWidth}px`;
  clone.style.height = "auto";
  clone.style.minHeight = "0";
  clone.style.overflow = "visible";
  const typography = getComputedStyle(textBox);
  for (const property of ["font-family", "font-size", "line-height", "letter-spacing", "--slide-body-family", "--slide-body-size", "--slide-body-weight", "--slide-body-style", "--slide-body-decoration", "--slide-body-align"]) {
    const value = typography.getPropertyValue(property);
    if (value) clone.style.setProperty(property, value);
  }
  clone.querySelectorAll<HTMLElement>("[contenteditable]").forEach((element) => element.removeAttribute("contenteditable"));
  const content = clone.firstElementChild as HTMLElement | null;
  if (content) {
    content.style.width = "max-content";
    content.style.minWidth = "0";
    content.style.maxWidth = `${maxWidth}px`;
    content.style.height = "auto";
    content.style.minHeight = "0";
  }
  document.body.appendChild(clone);
  const rect = clone.getBoundingClientRect();
  clone.remove();
  return { width: rect.width, height: rect.height };
}

export function SlideObject({ block, courseId, index, total, master, area: customArea, footerTop, headerBottom, snapEnabled = true, lessonBlocks = [], selected, onSelect, onFrame, onChange, onEditorFocus, onFooterSnap, onSnapGuides, readOnly = false, suppressTransforms = false, suspendAutoFit = false, onPointerSelect, onEnterMember }: {
  block: ContentBlock;
  courseId?: string;
  index: number;
  total: number;
  master?: SlideMaster;
  area?: SlideSize;
  footerTop?: number;
  headerBottom?: number;
  snapEnabled?: boolean;
  lessonBlocks?: ContentBlock[];
  selected: boolean;
  readOnly?: boolean;
  suppressTransforms?: boolean;
  suspendAutoFit?: boolean;
  onPointerSelect?: (event: PointerEvent<HTMLElement>) => boolean;
  onEnterMember?: () => void;
  onSelect: () => void;
  onFrame: (frame: SlideFrame, options?: { recordHistory?: boolean }) => void;
  onChange: (block: ContentBlock) => void;
  onEditorFocus: (editor: Editor) => void;
  onFooterSnap?: (snapped: boolean) => void;
  onSnapGuides?: (guides: SlideSnapGuide[]) => void;
}) {
  const area = customArea ?? resolveSlideObjectArea(master);
  const savedFrame = resolveSlideFrame(block, index, total, area);
  const editableText = isSlideTextBlock(block);
  const editableInteractive = block.type === "accordion" || block.type === "processSteps" || block.type === "flipCard" || block.type === "labeledGraphic" || block.type === "interactionButton" || block.type === "audioInstruction" || block.type === "balloonArcher" || block.type === "peelToReveal" || block.type === "hangingRopeCards" || block.type === "audio" || (block.type === "gallery" && block.data.layout === "carousel");
  const [draftFrame, setDraftFrame] = useState<SlideFrame | null>(null);
  const draftFrameRef = useRef<SlideFrame | null>(null);
  const frame = draftFrame ?? savedFrame;
  const drag = useRef<{ pointerId: number; target: HTMLElement; kind: SlideTransformKind; handle: SlideResizeHandle; startX: number; startY: number; startAngle: number; frame: SlideFrame; bounds: DOMRect } | null>(null);
  const objectRef = useRef<HTMLDivElement>(null);
  const animationEffect = useSlideObjectAnimation(objectRef, block.slideAnimation, false);
  const fitToText = editableText && !readOnly && !suspendAutoFit && block.slideTextLayout?.fitToText !== false;

  useEffect(() => () => {
    const current = drag.current;
    drag.current = null;
    if (current?.target.hasPointerCapture?.(current.pointerId)) current.target.releasePointerCapture(current.pointerId);
  }, []);

  useLayoutEffect(() => {
    if (readOnly || suspendAutoFit || block.type !== "audio" || block.slidePlayback?.fitHeight === false) return;
    const object = objectRef.current;
    const player = object?.querySelector<HTMLElement>("[data-slide-audio-content]");
    if (!object || !player) return;
    const measure = () => {
      if (!player.offsetHeight || drag.current) return;
      const border = getComputedStyle(object);
      const height = player.offsetHeight + (Number.parseFloat(border.borderTopWidth) || 0) + (Number.parseFloat(border.borderBottomWidth) || 0);
      const current = resolveSlideFrame(block, index, total, area);
      const heightPercent = Math.min(100, height / area.height * 100);
      const next = fitSlideFrame(current, { height: heightPercent, y: Math.min(current.y, 100 - heightPercent) }, minimumSlideAudioHeight);
      // Fitting is derived layout: keep it with the author's edit so Undo can
      // restore a title/control change without undoing and redoing the fit.
      if (Math.abs(next.height - current.height) >= .01) onFrame(next, { recordHistory: false });
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(player);
    document.fonts?.addEventListener("loadingdone", measure);
    return () => { observer?.disconnect(); document.fonts?.removeEventListener("loadingdone", measure); };
  }, [block, index, total, area, onFrame, readOnly, suspendAutoFit]);

  useLayoutEffect(() => {
    if (!fitToText) return;
    const object = objectRef.current;
    const textBox = object?.querySelector<HTMLElement>("[data-slide-text-box]");
    const objects = object?.closest<HTMLElement>("[data-slide-objects]");
    if (!textBox || !objects) return;
    const measuredTextBox = textBox;
    let frameId: number | null = null;
    let disposed = false;
    function measure() {
      frameId = null;
      if (disposed || drag.current) return;
      const bounds = objects?.getBoundingClientRect();
      if (!bounds?.width || !bounds.height) return;
      const current = resolveSlideFrame(block, index, total, area);
      const defaultFrame = defaultSlideFrame(index, block.type);
      const maxWidthPercent = Math.min(95, 100 - current.x, Math.max(current.width, defaultFrame.width));
      // The detached clone is unscaled. Measure and save in logical canvas pixels,
      // otherwise editor zoom changes the saved object's width and height.
      const measured = measureTextBox(measuredTextBox, area.width * maxWidthPercent / 100);
      if (!measured.width || !measured.height) return;
      const border = object ? getComputedStyle(object) : null;
      const next = fitSlideTextFrame(current, { width: measured.width + (Number.parseFloat(border?.borderLeftWidth ?? "0") || 0) + (Number.parseFloat(border?.borderRightWidth ?? "0") || 0), height: measured.height + (Number.parseFloat(border?.borderTopWidth ?? "0") || 0) + (Number.parseFloat(border?.borderBottomWidth ?? "0") || 0) }, area);
      if (Math.abs(next.width - current.width) < 0.01 && Math.abs(next.height - current.height) < 0.01) return;
      onFrame(next);
    }
    function schedule() {
      if (disposed || frameId !== null) return;
      if (typeof requestAnimationFrame === "function") frameId = requestAnimationFrame(measure);
      else measure();
    }
    schedule();
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    resize?.observe(measuredTextBox);
    const mutation = typeof MutationObserver === "undefined" ? null : new MutationObserver(schedule);
    mutation?.observe(measuredTextBox, { subtree: true, childList: true, characterData: true, attributes: true });
    document.fonts?.addEventListener("loadingdone", schedule);
    return () => {
      disposed = true;
      if (frameId !== null) cancelAnimationFrame(frameId);
      resize?.disconnect();
      mutation?.disconnect();
      document.fonts?.removeEventListener("loadingdone", schedule);
    };
  }, [area, block, fitToText, index, onFrame, total]);

  function start(event: PointerEvent<HTMLElement>, kind: SlideTransformKind, fromHandle = false, handle: SlideResizeHandle = "bottom-right") {
    if (block.type === "flipCard" && !fromHandle) return;
    if (readOnly || suppressTransforms || (!fromHandle && (event.shiftKey || event.ctrlKey || event.metaKey)) || event.button !== 0 || drag.current) return;
    if (kind === "move" && !fromHandle && (event.target as HTMLElement).closest("button, a, input, textarea, select, audio, video, [contenteditable='true']")) return;
    const bounds = event.currentTarget.closest<HTMLElement>("[data-slide-objects]")?.getBoundingClientRect();
    if (!bounds?.width || !bounds.height) return;
    onSelect();
    const centerX = (bounds.left || 0) + (frame.x + frame.width / 2) / 100 * bounds.width;
    const centerY = (bounds.top || 0) + (frame.y + frame.height / 2) / 100 * bounds.height;
    drag.current = { pointerId: event.pointerId, target: event.currentTarget, kind, handle, startX: event.clientX, startY: event.clientY, startAngle: Math.atan2(event.clientY - centerY, event.clientX - centerX), frame, bounds };
    draftFrameRef.current = null;
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }
  function move(event: PointerEvent<HTMLElement>) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    event.stopPropagation();
    const deltaX = (event.clientX - current.startX) / current.bounds.width * 100;
    const deltaY = (event.clientY - current.startY) / current.bounds.height * 100;
    const centerX = (current.bounds.left || 0) + (current.frame.x + current.frame.width / 2) / 100 * current.bounds.width;
    const centerY = (current.bounds.top || 0) + (current.frame.y + current.frame.height / 2) / 100 * current.bounds.height;
    let next = current.kind === "rotate"
      ? rotateSlideFrame(current.frame, current.startAngle, Math.atan2(event.clientY - centerY, event.clientX - centerX), event.shiftKey)
      : current.kind === "resize"
        ? resizeSlideFrameFromHandle(block, current.frame, current.handle, { x: deltaX / 100 * area.width, y: deltaY / 100 * area.height }, area)
        : fitSlideFrame(current.frame, { x: current.frame.x + deltaX, y: current.frame.y + deltaY }, block.type === "audio" ? minimumSlideAudioHeight : undefined);
    if (current.kind === "move" && snapEnabled && !event.altKey) {
      const snap = snapSlideObjectFrame(next, area, current.bounds, { headerBottom, footerTop });
      next = snap.frame;
      onFooterSnap?.(snap.guides.some((guide) => guide.id === "footer"));
      onSnapGuides?.(snap.guides);
    } else {
      onFooterSnap?.(false);
      onSnapGuides?.([]);
    }
    draftFrameRef.current = next;
    setDraftFrame(next);
  }
  function cancel() {
    const current = drag.current;
    drag.current = null;
    draftFrameRef.current = null;
    setDraftFrame(null);
    onFooterSnap?.(false);
    onSnapGuides?.([]);
    if (current?.target.hasPointerCapture?.(current.pointerId)) current.target.releasePointerCapture(current.pointerId);
  }

  function commit(nextFrame: SlideFrame, kind: SlideTransformKind) {
    if (kind === "resize" && editableText) {
      onChange({ ...block, slideFrame: nextFrame, slideTextLayout: { ...resolveSlideTextLayout(block.slideTextLayout), fitToText: false } });
    } else if (kind === "resize" && block.type === "audio" && Math.abs(nextFrame.height - savedFrame.height) > .000001) {
      onChange({ ...block, slideFrame: nextFrame, slidePlayback: { autoPlay: false, showControls: true, ...block.slidePlayback, fitHeight: false } });
    } else {
      onFrame(nextFrame);
    }
  }

  function stop(event: PointerEvent<HTMLElement>) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    event.stopPropagation();
    move(event);
    drag.current = null;
    onFooterSnap?.(false);
    onSnapGuides?.([]);
    if (current.target.hasPointerCapture?.(event.pointerId)) current.target.releasePointerCapture(event.pointerId);
    const next = draftFrameRef.current;
    if (next && (["x", "y", "width", "height", "rotation"] as const).some((key) => Math.abs((next[key] ?? 0) - (current.frame[key] ?? 0)) > .000001)) {
      commit(next, current.kind);
    }
    draftFrameRef.current = null;
    setDraftFrame(null);
  }

  function transformKey(event: KeyboardEvent<HTMLButtonElement>, kind: SlideTransformKind, handle: SlideResizeHandle = "bottom-right") {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key) || drag.current) return;
    event.preventDefault();
    event.stopPropagation();
    const step = event.shiftKey ? 10 : 1;
    const x = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
    const y = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
    const next = kind === "rotate"
      ? { ...frame, rotation: normalizeSlideRotation((frame.rotation ?? 0) + (x + y > 0 ? 1 : -1) * (event.shiftKey ? 15 : 1)) }
      : kind === "resize" ? resizeSlideFrameFromHandle(block, frame, handle, { x, y }, area)
        : fitSlideFrame(frame, { x: frame.x + x / area.width * 100, y: frame.y + y / area.height * 100 }, block.type === "audio" ? minimumSlideAudioHeight : undefined);
    commit(next, kind);
  }

  function recordMediaDimensions(dimensions: { width: number; height: number }) {
    if (readOnly || suspendAutoFit || !isSlideMediaObject(block)) return;
    const parsed = slideMediaSchema.safeParse({ source: block.data.src, ...dimensions });
    if (!parsed.success) return;
    const previous = resolveSlideMedia(block);
    if (previous?.width === dimensions.width && previous.height === dimensions.height) return;
    onChange({ ...block, slideMedia: parsed.data, slideFrame: fitSlideMediaFrame(savedFrame, croppedDimensions(parsed.data, resolveSlideCrop(block)), { width: savedFrame.width }, area) });
  }

  return (
    <div ref={objectRef} tabIndex={selected ? 0 : -1} data-slide-object-animation={animationEffect} data-slide-object-frame data-slide-object-id={block.id} data-slide-object-locked={readOnly || undefined} onFocusCapture={() => { if (!readOnly) onSelect(); }} onPointerDownCapture={(event) => { if (readOnly || onPointerSelect?.(event)) { event.preventDefault(); event.stopPropagation(); return; } if (event.button === 0) onSelect(); }} onDoubleClick={onEnterMember} onPointerDown={(event) => start(event, "move")} onPointerMove={move} onPointerUp={stop} onPointerCancel={(event) => { if (drag.current?.pointerId === event.pointerId) cancel(); }} onLostPointerCapture={(event) => { if (drag.current?.pointerId === event.pointerId) cancel(); }} onKeyDownCapture={(event) => { if (event.key === "Escape" && drag.current) { event.preventDefault(); event.stopPropagation(); cancel(); } }} onDragStart={(event) => event.preventDefault()} className={`pointer-events-auto absolute ${selected ? "overflow-visible" : "overflow-hidden"} outline-2 outline-offset-1 ${editableText || editableInteractive ? "touch-auto" : "touch-none"} ${selected ? "cursor-grab outline-indigo-500 active:cursor-grabbing" : "cursor-grab outline-transparent hover:outline-indigo-300"}`} style={{ ...slideFrameStyle(frame), zIndex: selected && !readOnly && !suppressTransforms ? 1000 : frame.z + 1, ...slideObjectSurfaceStyle(block, master?.backgroundColor, master?.textColor) }}>
      <div inert={readOnly || suppressTransforms} className={`h-full overflow-hidden rounded-[inherit] ${readOnly || suppressTransforms ? "pointer-events-none" : editableText ? "cursor-text" : editableInteractive ? "cursor-default" : "pointer-events-none"}`}>
        <SlideObjectContent media={isSlideMediaObject(block) || block.type === "flipCard"} scroll={hasProcessStepMedia(block)}>
        {readOnly ? <PreviewBlock block={block} authoring decorative lessonBlocks={lessonBlocks} slideLayout device="desktop" orientation="landscape" /> : block.type === "accordion" ? <AccordionBlockEditor block={block} onChange={onChange} onEditorFocus={onEditorFocus} /> : block.type === "processSteps" ? <ProcessStepsBlockEditor block={block} courseId={courseId} onChange={onChange} onEditorFocus={onEditorFocus} /> : block.type === "flipCard" ? <SlideFlipCardEditor block={block} /> : isSlideTextBlock(block) ? <SlideTextObjectEditor block={block} onChange={onChange} onEditorFocus={onEditorFocus} /> : block.type === "audioInstruction" ? <AudioInstruction key={block.data.src} block={block} authoring presentation guideEditing={selected && !suppressTransforms} onGuideChange={(change) => onChange({ ...block, data: { ...block.data, guide: { ...(block.data.guide ?? defaultAudioInstructionGuide), ...change } } })} /> : (block.type === "labeledGraphic" || block.type === "balloonArcher") ? <ContentBlockPreview block={block} onChange={onChange} presentation /> : isSlideMediaObject(block) ? <SlideMediaObject key={block.data.src} block={block} onDimensions={recordMediaDimensions} /> : <PreviewBlock block={block} authoring lessonBlocks={lessonBlocks} slideLayout device="desktop" orientation="landscape" />}
        </SlideObjectContent>
      </div>
      {selected && !readOnly && !suppressTransforms && <SlideObjectTransformHandles type={block.type} insetTools={frame.y / 100 * area.height < 40} rotation={frame.rotation ?? 0} onStart={(event, kind, handle) => { event.stopPropagation(); start(event, kind, true, handle); }} onKeyDown={transformKey} />}
    </div>
  );
}

