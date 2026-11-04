"use client";

/* eslint-disable @next/next/no-img-element -- This component is also bundled into static course exports. */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { Check, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ColorPicker } from "@/components/ui/color-picker";
import { LessonMapArtwork } from "@/components/lesson-map-artwork";
import { InteractiveScene } from "@/components/interactive-scene";
import { fitGraphicImage, projectGraphicPoint, unprojectGraphicPoint, type GraphicImageFit } from "@/lib/editor/graphic-layout";
import type { ContentBlock, LessonMapTemplate } from "@/lib/schemas/block";
import { backgroundPaint, parseGradient, solidColor, textPaint } from "@/lib/color";

type GraphicMarker = Extract<ContentBlock, { type: "labeledGraphic" }>['data']['markers'][number];
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;


export function InteractiveLabeledGraphic({
  blockId,
  src,
  alt,
  mapTemplate,
  objectFit = "contain",
  markers,
  markerColor,
  textColor = "#ffffff",
  radarColor,
  radarSize = 3,
  radarWeight = 2,
  interactionMode,
  sceneTheme,
  challengePrompt,
  successMessage,
  editable = false,
  presentation = false,
  onMarkerPositionChange,
  onMarkerChange,
  onMarkerInteract,
}: {
  blockId: string;
  src: string;
  alt: string;
  mapTemplate?: LessonMapTemplate;
  objectFit?: GraphicImageFit;
  markers: GraphicMarker[];
  markerColor?: string;
  textColor?: string;
  radarColor?: string;
  radarSize?: number;
  radarWeight?: number;
  interactionMode?: "explore" | "spotTarget";
  sceneTheme?: "data" | "security" | "network" | "agriculture";
  challengePrompt?: string;
  successMessage?: string;
  editable?: boolean;
  presentation?: boolean;
  onMarkerPositionChange?: (markerId: string, position: { x: number; y: number }) => void;
  onMarkerChange?: (markerId: string, update: Partial<Pick<GraphicMarker, "label" | "description" | "color" | "radarEnabled">>) => void;
  onMarkerInteract?: (markerId: string) => void;
}) {
  const [activeMarkerId, setActiveMarkerId] = useState("");
  const [gameSolved, setGameSolved] = useState(false);
  const [gameAttempts, setGameAttempts] = useState(0);
  const [lastMissedMarkerId, setLastMissedMarkerId] = useState("");
  const [missedMarkerIds, setMissedMarkerIds] = useState<string[]>([]);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const [imageSize, setImageSize] = useState<{ source: string; width: number; height: number } | null>(null);
  const popoverRef = useRef<HTMLElement>(null);
  const [popoverPosition, setPopoverPosition] = useState<{
    markerId: string;
    left: number;
    top: number;
  } | null>(null);
  const draggingPointerId = useRef<number | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const didDrag = useRef(false);
  const [dragPosition, setDragPosition] = useState<{ markerId: string; x: number; y: number } | null>(null);
  const dragPositionRef = useRef<typeof dragPosition>(null);
  const activeMarker = markers.find((marker) => marker.id === activeMarkerId) ?? markers[0];
  const showPopup = activeMarkerId !== "" && activeMarker?.id === activeMarkerId;
  const sharedMarkerColor = markerColor ?? "var(--course-primary, #2f5f9f)";
  const isSpotTargetGame = interactionMode === "spotTarget";
  const usesIllustratedScene = Boolean(sceneTheme && (!src || isSpotTargetGame));
  const usesMap = Boolean(mapTemplate && !isSpotTargetGame);
  const fitFrame = presentation && !isSpotTargetGame;
  const sourceWidth = usesMap ? 720 : usesIllustratedScene ? 1200 : imageSize?.source === src ? imageSize.width : frameSize.width;
  const sourceHeight = usesMap ? 440 : usesIllustratedScene ? 675 : imageSize?.source === src ? imageSize.height : frameSize.height;
  const imageRect = fitGraphicImage(frameSize, { width: sourceWidth, height: sourceHeight }, objectFit);
  const artworkStyle: CSSProperties = fitFrame && frameSize.width && frameSize.height ? imageRect : { inset: 0 };
  const activePosition = activeMarker && fitFrame ? projectGraphicPoint(activeMarker, frameSize, imageRect) : activeMarker;
  const lastMissedMarker = markers.find((marker) => marker.id === lastMissedMarkerId);
  const gameScore = gameSolved ? Math.max(25, 100 - (gameAttempts - 1) * 15) : 0;

  useIsomorphicLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!fitFrame || !canvas) return;
    const measure = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width && height) setFrameSize((previous) => previous.width === width && previous.height === height ? previous : { width, height });
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(canvas);
    window.addEventListener("resize", measure);
    return () => { observer?.disconnect(); window.removeEventListener("resize", measure); };
  }, [fitFrame]);

  useIsomorphicLayoutEffect(() => {
    const canvas = canvasRef.current;
    const popover = popoverRef.current;
    if (!showPopup || !activeMarker || !canvas || !popover) {
      setPopoverPosition(null);
      return;
    }

    const padding = 8;
    const gap = 12;
    const updatePosition = () => {
      const canvasBounds = canvas.getBoundingClientRect();
      const popoverBounds = popover.getBoundingClientRect();
      const canvasWidth = canvas.clientWidth || canvasBounds.width;
      const canvasHeight = canvas.clientHeight || canvasBounds.height;
      if (canvasWidth <= 0 || canvasHeight <= 0) return;
      // Position in layout pixels; slide and object transforms already scale these coordinates.
      const scaleX = canvasBounds.width / canvasWidth || 1;
      const scaleY = canvasBounds.height / canvasHeight || 1;

      const width = Math.min(popover.offsetWidth || popoverBounds.width / scaleX, Math.max(0, canvasWidth - padding * 2));
      const height = Math.min(popover.offsetHeight || popoverBounds.height / scaleY, Math.max(0, canvasHeight - padding * 2));
      const point = fitFrame ? projectGraphicPoint(activeMarker, { width: canvasWidth, height: canvasHeight }, fitGraphicImage({ width: canvasWidth, height: canvasHeight }, { width: sourceWidth || canvasWidth, height: sourceHeight || canvasHeight }, objectFit)) : activeMarker;
      const markerX = canvasWidth * (point.x / 100);
      const markerY = canvasHeight * (point.y / 100);
      const rightPosition = markerX + gap;
      const leftPosition = markerX - width - gap;
      const rightSpace = canvasWidth - markerX - gap - padding;
      const leftSpace = markerX - gap - padding;

      let left = rightSpace >= width
        ? rightPosition
        : leftSpace >= width
          ? leftPosition
          : rightSpace >= leftSpace
            ? rightPosition
            : leftPosition;
      left = Math.max(padding, Math.min(left, canvasWidth - width - padding));

      const belowPosition = markerY + gap;
      const abovePosition = markerY - height - gap;
      const belowSpace = canvasHeight - markerY - gap - padding;
      const aboveSpace = markerY - gap - padding;
      let top = belowSpace >= height
        ? belowPosition
        : aboveSpace >= height
          ? abovePosition
          : belowSpace >= aboveSpace
            ? belowPosition
            : abovePosition;
      top = Math.max(padding, Math.min(top, canvasHeight - height - padding));

      setPopoverPosition((current) => {
        if (
          current?.markerId === activeMarker.id &&
          Math.abs(current.left - left) < 0.5 &&
          Math.abs(current.top - top) < 0.5
        ) {
          return current;
        }
        return { markerId: activeMarker.id, left, top };
      });
    };

    updatePosition();
    const resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(updatePosition);
    resizeObserver?.observe(canvas);
    resizeObserver?.observe(popover);
    window.addEventListener("resize", updatePosition);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updatePosition);
    };
  }, [activeMarker?.description, activeMarker?.id, activeMarker?.label, activeMarker?.x, activeMarker?.y, showPopup, fitFrame, objectFit, sourceWidth, sourceHeight]);

  function updateMarkerPosition(
    markerId: string,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    const canvas = canvasRef.current;
    const bounds = canvas?.getBoundingClientRect();
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return;
    const pointer = { x: (event.clientX - bounds.left) / bounds.width * 100, y: (event.clientY - bounds.top) / bounds.height * 100 };
    const size = { width: canvas?.clientWidth || bounds.width, height: canvas?.clientHeight || bounds.height };
    const projected = fitFrame ? unprojectGraphicPoint(pointer, size, fitGraphicImage(size, { width: sourceWidth || size.width, height: sourceHeight || size.height }, objectFit)) : pointer;
    const x = Math.min(100, Math.max(0, projected.x));
    const y = Math.min(100, Math.max(0, projected.y));
    const position = { markerId, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 };
    dragPositionRef.current = position;
    setDragPosition(position);
  }

  function handlePointerDown(
    markerId: string,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    if (!editable || !onMarkerPositionChange) return;
    draggingPointerId.current = event.pointerId;
    dragStart.current = { x: event.clientX, y: event.clientY };
    didDrag.current = false;
    dragPositionRef.current = null;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(
    markerId: string,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    if (!editable || draggingPointerId.current !== event.pointerId) return;
    if (dragStart.current) {
      const distance = Math.hypot(
        event.clientX - dragStart.current.x,
        event.clientY - dragStart.current.y,
      );
      if (distance > 3) didDrag.current = true;
    }
    if (didDrag.current) {
      setActiveMarkerId("");
      updateMarkerPosition(markerId, event);
    }
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    if (draggingPointerId.current !== event.pointerId) return;
    draggingPointerId.current = null;
    dragStart.current = null;
    const position = dragPositionRef.current;
    dragPositionRef.current = null;
    setDragPosition(null);
    if (position && event.type !== "pointercancel") onMarkerPositionChange?.(position.markerId, { x: position.x, y: position.y });
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }

  return (
    <div
      role="group"
      aria-label={isSpotTargetGame ? challengePrompt || `Spot the clue ${blockId}` : `Interactive graphic ${blockId}`}
      className={isSpotTargetGame ? "overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-white shadow-xl" : fitFrame ? "h-full w-full min-h-0 overflow-clip" : "space-y-4"}
      onClick={(event) => {
        const target = event.target;
        if (
          target instanceof Element &&
          target.closest("button, .labeled-graphic-popover")
        ) {
          return;
        }
        setActiveMarkerId("");
      }}
    >
      {(usesIllustratedScene || usesMap) && <span className="sr-only">{alt}</span>}
      {isSpotTargetGame && (
        <div className="flex items-center justify-between gap-3 bg-slate-950 px-4 pb-3 pt-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-cyan-400/15 text-cyan-300">
              <span aria-hidden="true" className="text-lg">◎</span>
            </span>
            <div className="min-w-0">
              <p className="m-0 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">Spot the clue</p>
              <p className="m-0 truncate text-sm font-semibold text-white">{challengePrompt}</p>
            </div>
          </div>
          <div className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-right">
            <p className="m-0 text-[9px] font-bold uppercase tracking-wider text-slate-400">Score</p>
            <p className="m-0 text-lg font-black tabular-nums text-amber-300">{gameScore}</p>
          </div>
        </div>
      )}
      <div
        ref={canvasRef}
        data-testid="labeled-graphic-canvas"
        className={`relative isolate ${isSpotTargetGame ? "aspect-video overflow-hidden border-y border-white/10 bg-slate-900" : fitFrame ? "shrink-0 overflow-clip rounded-xl bg-slate-100" : usesMap ? "aspect-[18/11] overflow-hidden rounded-xl bg-slate-100" : usesIllustratedScene ? "aspect-video overflow-hidden rounded-xl bg-slate-100" : "rounded-xl bg-slate-100"}`}
        style={fitFrame ? { width: "100%", height: "100%" } : undefined}
      >
        {usesMap ? (
          <div aria-hidden="true" className="absolute" style={artworkStyle}><LessonMapArtwork template={mapTemplate!} className="size-full" stretch={fitFrame} /></div>
        ) : usesIllustratedScene ? (
          <div aria-hidden="true" className="absolute overflow-hidden" style={artworkStyle}>
            <InteractiveScene theme={sceneTheme!} stretch={fitFrame} />
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/35 via-transparent to-slate-950/10" />
          </div>
        ) : (
          <img src={src} alt={alt} className={fitFrame ? "block h-full w-full rounded-xl" : "block h-auto w-full rounded-xl"} style={fitFrame ? { objectFit } : undefined} onLoad={(event) => {
            const image = event.currentTarget;
            if (image.naturalWidth && image.naturalHeight) setImageSize({ source: src, width: image.naturalWidth, height: image.naturalHeight });
          }} />
        )}
        {markers.map((marker, index) => {
          const selected = marker.id === activeMarkerId;
          const missed = missedMarkerIds.includes(marker.id);
          const found = gameSolved && marker.isTarget;
          const pointColor = marker.color ?? sharedMarkerColor;
          const radarEnabled = marker.radarEnabled !== false;
          const pointText = marker.displayMode === "number" ? String(marker.displayNumber ?? index + 1)
            : marker.displayMode === "text" ? marker.displayText?.trim() || String(index + 1)
              : String(index + 1);
          const sourcePosition = dragPosition?.markerId === marker.id ? dragPosition : marker;
          const position = fitFrame ? projectGraphicPoint(sourcePosition, frameSize, imageRect) : sourcePosition;
          return (
            <button
              key={marker.id}
              type="button"
              aria-label={isSpotTargetGame ? `Inspect hotspot ${index + 1}` : `${marker.label || `Marker ${index + 1}`}: show explanation`}
              aria-pressed={isSpotTargetGame ? undefined : selected}
              disabled={isSpotTargetGame && gameSolved}
              onPointerDown={(event) => handlePointerDown(marker.id, event)}
              onPointerMove={(event) => handlePointerMove(marker.id, event)}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onClick={() => {
                if (didDrag.current) {
                  didDrag.current = false;
                  return;
                }
                if (editable && onMarkerChange) {
                  setActiveMarkerId(marker.id);
                  return;
                }
                if (isSpotTargetGame) {
                  if (gameSolved) return;
                  const nextAttempt = gameAttempts + 1;
                  setGameAttempts(nextAttempt);
                  onMarkerInteract?.(marker.id);
                  if (marker.isTarget) {
                    setGameSolved(true);
                    setLastMissedMarkerId("");
                  } else {
                    setLastMissedMarkerId(marker.id);
                    setMissedMarkerIds((current) => current.includes(marker.id) ? current : [...current, marker.id]);
                  }
                  return;
                }
                setActiveMarkerId(marker.id);
                onMarkerInteract?.(marker.id);
              }}
              className={isSpotTargetGame
                ? `absolute grid h-12 ${marker.displayMode === "text" ? "min-w-12 max-w-24 px-2" : "w-12"} -translate-x-1/2 -translate-y-1/2 touch-none place-items-center rounded-full border-2 text-sm font-black shadow-[0_0_24px_rgba(34,211,238,0.38)] transition-all hover:scale-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/80 disabled:cursor-default ${found ? "border-white bg-emerald-400 text-emerald-950 shadow-[0_0_32px_rgba(74,222,128,0.8)]" : missed ? "border-white bg-rose-500 text-white" : "border-cyan-100 bg-cyan-400/90 text-slate-950"} ${editable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`
                : `cursor-pointer ${radarEnabled ? "labeled-graphic-radar" : ""} ${parseGradient(radarColor ?? pointColor) ? "labeled-graphic-radar-gradient" : ""} absolute grid h-9 ${marker.displayMode === "text" ? "min-w-9 max-w-24 px-2" : "w-9"} -translate-x-1/2 -translate-y-1/2 touch-none place-items-center rounded-full border-2 border-white text-xs font-bold text-white shadow-lg transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 ${editable ? "cursor-grab active:cursor-grabbing" : ""}`}
              style={{
                left: `${position.x}%`,
                top: `${position.y}%`,
                ...(!isSpotTargetGame || (!missed && !found && (marker.color || markerColor)) ? backgroundPaint(pointColor) : {}),
                color: isSpotTargetGame ? undefined : solidColor(textColor),
                "--radar-color": solidColor(radarColor ?? pointColor),
                "--radar-gradient": radarColor ?? pointColor,
                "--radar-size": `${radarSize}px`,
                "--radar-weight": `${radarWeight}px`,
              } as CSSProperties}
            >
              {isSpotTargetGame && radarEnabled && !missed && !found && <span aria-hidden="true" className="absolute rounded-full motion-safe:animate-ping" style={{ inset: `-${radarSize}px`, border: `${radarWeight}px solid ${solidColor(radarColor ?? pointColor)}`, ...backgroundPaint(radarColor ?? pointColor, 40) }} />}
              <span className="relative z-10 min-w-0 max-w-full truncate" style={!isSpotTargetGame || (!missed && !found && parseGradient(textColor)) ? textPaint(textColor) : undefined}>{found ? <Check size={20} aria-hidden="true" /> : missed ? <X size={18} aria-hidden="true" /> : pointText}</span>
            </button>
          );
        })}
        {(!isSpotTargetGame || (editable && onMarkerChange)) && showPopup && activeMarker && (
          <section
            key={activeMarker.id}
            ref={popoverRef}
            aria-live="polite"
            aria-atomic="true"
            className="labeled-graphic-popover absolute z-20 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-xl sm:p-5"
            style={{
              width: fitFrame ? "min(14rem, calc(100% - 1rem))" : undefined,
              left: popoverPosition?.markerId === activeMarker.id
                ? `${popoverPosition.left}px`
                : `${activePosition?.x ?? activeMarker.x}%`,
              top: popoverPosition?.markerId === activeMarker.id
                ? `${popoverPosition.top}px`
                : `${activePosition?.y ?? activeMarker.y}%`,
              transform: popoverPosition?.markerId === activeMarker.id
                ? undefined
                : `${activeMarker.x < 28 ? "translateX(0.5rem)" : activeMarker.x > 72 ? "translateX(calc(-100% - 0.5rem))" : "translateX(-50%)"} ${activeMarker.y > 58 ? "translateY(calc(-100% - 1rem))" : "translateY(1rem)"}`,
            }}
          >
            {editable && onMarkerChange ? <div className="space-y-2">
              <Input aria-label="Point title" value={activeMarker.label} maxLength={100} placeholder="Point title" className="h-8 text-xs" onChange={(event) => onMarkerChange(activeMarker.id, { label: event.target.value })} />
              <Textarea aria-label="Point explanation" value={activeMarker.description} maxLength={2000} placeholder="Point explanation" className="min-h-16 text-xs" onChange={(event) => onMarkerChange(activeMarker.id, { description: event.target.value })} />
              <label className="block space-y-1 text-xs text-slate-700">Point color<ColorPicker allowGradient={presentation} aria-label="Point color" value={activeMarker.color ?? markerColor ?? "#2f5f9f"} onChange={(color) => onMarkerChange(activeMarker.id, { color: color })} /></label>
              <label className="flex items-center gap-2 text-xs text-slate-700"><Checkbox aria-label="Point radar animation" checked={activeMarker.radarEnabled !== false} onChange={(event) => onMarkerChange(activeMarker.id, { radarEnabled: event.target.checked })} />Radar animation</label>
              <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setActiveMarkerId("")}>Done</Button>
            </div> : <>
            <p className="text-sm font-semibold text-slate-900">
              {activeMarker.label || `Marker ${markers.findIndex((marker) => marker.id === activeMarker.id) + 1}`}
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-700">
              {activeMarker.description || "Add an explanation for this part of the image."}
            </p>
            </>}
          </section>
        )}
      </div>
      {isSpotTargetGame && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <p
            role="status"
            aria-live="polite"
            className={`m-0 min-w-0 flex-1 text-sm font-medium ${gameSolved ? "text-emerald-300" : lastMissedMarkerId ? "text-rose-200" : "text-slate-300"}`}
          >
            {gameSolved
              ? successMessage || "Clue found! Great work scanning the scene."
              : lastMissedMarker
                ? lastMissedMarker.missFeedback || "Not that spot. Keep scanning the scene and try again."
                : "Tap a hotspot in the scene to investigate it."}
          </p>
          {gameSolved ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              aria-label="Play again"
              onClick={() => {
                setGameSolved(false);
                setGameAttempts(0);
                setLastMissedMarkerId("");
                setMissedMarkerIds([]);
              }}
              className="cursor-pointer shrink-0 gap-2"
            >
              <RotateCcw size={14} aria-hidden="true" /> Play again
            </Button>
          ) : (
            <span className="shrink-0 rounded-full bg-white/5 px-3 py-1 text-xs font-semibold text-slate-400">
              {gameAttempts} {gameAttempts === 1 ? "scan" : "scans"}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

