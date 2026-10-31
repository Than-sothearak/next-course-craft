"use client";

/* eslint-disable @next/next/no-img-element -- Crop editing needs the original media dimensions. */
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Crop, Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { ContentBlock } from "@/lib/schemas/block";
import { fitSlideMediaFrame, resolveSlideFrame, type SlideSize } from "@/lib/editor/slide-design";
import { isSlideMediaObject, resolveSlideMedia } from "@/lib/editor/slide-objects";
import { cropToAspect, croppedDimensions, fullCrop, isSlideVideoFile, moveCrop, resizeCrop, resolveSlideCrop, type CropCorner, type CropRect } from "@/lib/editor/slide-crop";

type MediaBlock = Extract<ContentBlock, { type: "image" | "video" }>;
type Props = { block: MediaBlock; index: number; total: number; area: SlideSize; onChange: (block: ContentBlock) => void };
const corners: CropCorner[] = ["top-left", "top-right", "bottom-left", "bottom-right"];

function CropDialog({ block, index, total, area, onChange, onClose }: Props & { onClose: () => void }) {
  const [rect, setRect] = useState<CropRect>(resolveSlideCrop(block) ?? fullCrop);
  const [dimensions, setDimensions] = useState(resolveSlideMedia(block));
  const [aspect, setAspect] = useState("free");
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => { const media = video.current; return () => { if (media && !media.paused) media.pause(); }; }, []);
  const drag = useRef<{ pointerId: number; kind: "move" | CropCorner; x: number; y: number; rect: CropRect; bounds: DOMRect; target: HTMLElement } | null>(null);
  const ratio = aspect !== "free" && dimensions ? Number(aspect) / (dimensions.width / dimensions.height) : undefined;
  function metadata(width: number, height: number) { if (width > 0 && height > 0 && width <= 100000 && height <= 100000) { setDimensions({ source: block.data.src, width, height }); setError(""); } }
  function start(event: PointerEvent<HTMLElement>, kind: "move" | CropCorner) {
    if (event.button !== 0) return;
    const bounds = event.currentTarget.closest<HTMLElement>("[data-crop-stage]")!.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, kind, x: event.clientX, y: event.clientY, rect, bounds, target: event.currentTarget };
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current; if (!current || current.pointerId !== event.pointerId) return;
    const dx = (event.clientX - current.x) / current.bounds.width * 100, dy = (event.clientY - current.y) / current.bounds.height * 100;
    setRect(current.kind === "move" ? moveCrop(current.rect, dx, dy) : resizeCrop(current.rect, current.kind, dx, dy, ratio));
  }
  function stop(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current; if (!current || current.pointerId !== event.pointerId) return;
    if (event.type === "pointercancel") setRect(current.rect);
    drag.current = null;
    if (current.target.hasPointerCapture(event.pointerId)) current.target.releasePointerCapture(event.pointerId);
  }
  function apply() {
    if (!dimensions) return;
    const crop = rect;
    const full = crop.x === 0 && crop.y === 0 && crop.width === 100 && crop.height === 100;
    const frame = resolveSlideFrame(block, index, total, area);
    onChange({ ...block, slideMedia: dimensions, slideCrop: full ? undefined : { ...crop, source: block.data.src }, slideFrame: fitSlideMediaFrame(frame, croppedDimensions(dimensions, crop), { width: frame.width }, area) });
    onClose();
  }
  const sourceRatio = dimensions ? dimensions.width / dimensions.height : 16 / 9;
  return <Dialog open onClose={onClose} title={`Crop ${block.type}`} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!dimensions || Boolean(error)} onClick={() => apply()}>Apply crop</Button></>}>
    <div className="space-y-4">
      <p className="text-xs leading-5 text-slate-500">Drag the selection to move it. Drag a corner to resize. Arrow keys move the selection or the focused corner. Your original media is preserved.</p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="min-w-0 flex-1 text-xs text-slate-600">Aspect ratio<Select aria-label="Crop aspect ratio" value={aspect} disabled={!dimensions} onChange={(event) => { setAspect(event.target.value); if (event.target.value !== "free" && dimensions) setRect(cropToAspect(rect, dimensions, Number(event.target.value))); }}><option value="free">Freeform</option><option value="1">Square (1:1)</option><option value={16 / 9}>Widescreen (16:9)</option><option value={4 / 3}>Standard (4:3)</option><option value={3 / 4}>Portrait (3:4)</option><option value={9 / 16}>Portrait (9:16)</option></Select></label>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => { setRect(fullCrop); setAspect("free"); }}><RotateCcw size={14} aria-hidden="true" />Reset selection</Button>
      </div>
      <div className="flex justify-center rounded-md bg-slate-950 p-2">
        <div data-crop-stage className="relative w-full touch-none overflow-hidden" style={{ aspectRatio: sourceRatio, maxWidth: Math.min(512, 300 * sourceRatio) }} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop}>
          {block.type === "image" ? <img src={block.data.src} alt={block.data.alt} draggable={false} className="pointer-events-none h-full w-full object-contain" onLoad={(event) => metadata(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)} onError={() => setError("This image could not be loaded. Choose another image to crop.")} /> : <video ref={video} src={block.data.src} muted playsInline preload="metadata" className="pointer-events-none h-full w-full object-contain" onLoadedMetadata={(event) => metadata(event.currentTarget.videoWidth, event.currentTarget.videoHeight)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onError={() => setError("This video could not be loaded. Choose another video to crop.")} />}
          <div data-crop-selection role="group" aria-label="Crop selection" tabIndex={0} onPointerDown={(event) => start(event, "move")} onKeyDown={(event) => {
            if (event.target !== event.currentTarget || !dimensions || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
            event.preventDefault(); const step = event.shiftKey ? 10 : 1;
            setRect(moveCrop(rect, (event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0) * 100 / dimensions.width, (event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0) * 100 / dimensions.height));
          }} className="absolute cursor-move border border-white outline-none focus-visible:ring-2 focus-visible:ring-indigo-400" style={{ left: `${rect.x}%`, top: `${rect.y}%`, width: `${rect.width}%`, height: `${rect.height}%`, boxShadow: "0 0 0 9999px rgb(0 0 0 / 60%)" }}>
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">{Array.from({ length: 9 }, (_, i) => <span key={i} className="border border-white/20" />)}</div>
            {corners.map((corner) => <Button key={corner} variant="ghost" size="icon" aria-label={`Resize crop ${corner.replace("-", " ")}`} onPointerDown={(event) => start(event, corner)} onKeyDown={(event) => {
              if (!dimensions || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
              event.preventDefault(); event.stopPropagation(); const step = event.shiftKey ? 10 : 1;
              setRect(resizeCrop(rect, corner, (event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0) * 100 / dimensions.width, (event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0) * 100 / dimensions.height, ratio));
            }} className={`absolute z-10 size-3 rounded-sm border border-slate-900 bg-white hover:bg-indigo-100 ${corner.startsWith("top") ? "top-0" : "bottom-0"} ${corner.endsWith("left") ? "left-0" : "right-0"} ${corner === "top-left" || corner === "bottom-right" ? "cursor-nwse-resize" : "cursor-nesw-resize"}`} />)}
          </div>
        </div>
      </div>
      {block.type === "video" && <Button variant="outline" size="sm" onClick={() => { const media = video.current; if (!media) return; if (media.paused) void media.play()?.catch(() => setPlaying(false)); else media.pause(); }}>{playing ? <Pause size={14} /> : <Play size={14} />}{playing ? "Pause video" : "Preview video"}</Button>}
      {dimensions && <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{(["x", "y", "width", "height"] as const).map((field) => { const dimension = field === "x" || field === "width" ? dimensions.width : dimensions.height; const label = { x: "Left", y: "Top", width: "Width", height: "Height" }[field]; return <label key={field} className="space-y-1 text-xs text-slate-600">{label} (px)<Input type="number" aria-label={`Crop ${label.toLowerCase()} (px)`} min={field === "x" || field === "y" ? 0 : dimension / 100} max={dimension} step={0.01} value={Number((rect[field] * dimension / 100).toFixed(2))} onChange={(event) => { const value = event.target.valueAsNumber * 100 / dimension; if (!Number.isFinite(value)) return; setRect(field === "x" || field === "y" ? moveCrop(rect, field === "x" ? value - rect.x : 0, field === "y" ? value - rect.y : 0) : resizeCrop(rect, "bottom-right", field === "width" ? value - rect.width : 0, field === "height" ? value - rect.height : 0, ratio)); }} /></label>; })}</div>}
      {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
    </div>
  </Dialog>;
}

export function SlideMediaCropControls({ block, ...props }: Omit<Props, "block"> & { block: ContentBlock }) {
  const [open, setOpen] = useState(false);
  if (!isSlideMediaObject(block) || (block.type === "video" && !isSlideVideoFile(block))) return null;
  const crop = resolveSlideCrop(block);
  return <div className="space-y-2">
    <Button variant="outline" size="sm" className="w-full" onClick={() => setOpen(true)} disabled={!block.data.src}><Crop size={14} aria-hidden="true" />{crop ? "Edit crop" : `Crop ${block.type}`}</Button>
    {crop && <Button variant="ghost" size="sm" className="w-full" onClick={() => { const frame = resolveSlideFrame(block, props.index, props.total, props.area), media = resolveSlideMedia(block); props.onChange({ ...block, slideCrop: undefined, slideFrame: media ? fitSlideMediaFrame(frame, media, { width: frame.width }, props.area) : frame }); }}><RotateCcw size={14} aria-hidden="true" />Reset crop</Button>}
    {open && <CropDialog key={`${block.id}-${block.data.src}`} {...props} block={block} onClose={() => setOpen(false)} />}
  </div>;
}
