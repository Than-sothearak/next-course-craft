"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { CornerDownLeft, Grip, RotateCcw } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { contrastTextColor } from "@/lib/color";
import { PhysicsInteraction, type InteractionPhase } from "@/lib/interactive/physics/engine";
import { localInteractionPoint, orientPoint, peelDragProgress, peelGeometry, type Point } from "@/lib/interactive/physics/peel-geometry";
import type { PeelSettings } from "@/lib/schemas/peel-to-reveal";
import { useSlidePlaybackActive } from "@/app/courses/[courseId]/_components/slide-presentation/slide-playback-context";
import { slideMediaRestartEvent } from "@/lib/editor/slide-playback";
import { PeelSurface } from "./peel-surface";

export function PeelToReveal({ blockId, settings, children, presentation = false, authoring = false, decorative = false, interactedContentIds, onProgress }: {
  blockId: string; settings: PeelSettings; children: ReactNode; presentation?: boolean; authoring?: boolean; decorative?: boolean; interactedContentIds?: ReadonlySet<string>; onProgress?: (id: string) => void;
}) {
  const root = useRef<HTMLDivElement>(null), engine = useRef<PhysicsInteraction | null>(null);
  const tilt = useRef({ current: 0, target: 0 });
  const gesture = useRef<{ pointerId: number; start: Point; client: Point; moved: boolean; button: HTMLButtonElement } | null>(null);
  const reported = useRef(false), suppressClick = useRef(false), replaying = useRef(false);
  const focusAfterReveal = useRef(false);
  const [phase, setPhase] = useState<InteractionPhase>("idle");
  const reducedMotion = Boolean(useReducedMotion()), slideActive = useSlidePlaybackActive();
  const progressId = `${blockId}:revealed`, restored = !authoring && Boolean(interactedContentIds?.has(progressId));
  const latest = useRef({ onProgress, restored, authoring });
  useLayoutEffect(() => { latest.current = { onProgress, restored, authoring }; }, [onProgress, restored, authoring]);
  const revealed = phase === "revealed", active = !decorative && (!presentation || authoring || slideActive);
  const releaseCapture = useCallback(() => { const g = gesture.current; gesture.current = null; if (g?.button.hasPointerCapture?.(g.pointerId)) g.button.releasePointerCapture(g.pointerId); }, []);
  const pauseMedia = useCallback(() => { root.current?.querySelectorAll<HTMLMediaElement>("audio,video").forEach((media) => { if (!media.paused) media.pause(); }); }, []);
  const paint = useCallback((progress: number) => {
    const element = root.current; if (!element) return;
    if (progress === 0 || progress === 1) tilt.current = { current: 0, target: 0 };
    tilt.current.current += (tilt.current.target - tilt.current.current) * .2;
    const g = peelGeometry(progress, 680, 360, tilt.current.current);
    for (const selector of ["[data-peel-front]", "[data-peel-clip]", "[data-peel-texture]"]) element.querySelector(selector)?.setAttribute("d", g.front);
    element.querySelector("[data-peel-flap]")?.setAttribute("d", g.flap); element.querySelector("[data-peel-shadow]")?.setAttribute("d", g.shadow); element.querySelector("[data-peel-crease]")?.setAttribute("d", g.crease);
    element.querySelector("[data-peel-blur]")?.setAttribute("stdDeviation", String(3 + g.curl / 5));
    element.style.setProperty("--peel-progress", String(progress));
    element.querySelector<HTMLElement>("[data-peel-handle]")?.style.setProperty("opacity", String(Math.max(0, 1 - progress * 5)));
    element.setAttribute("data-peel-progress", progress.toFixed(4));
  }, []);
  const { dragResistance, springStiffness, damping, peelThreshold, animationDuration, autoComplete } = settings;
  useEffect(() => {
    const controller = new PhysicsInteraction({ dragResistance, springStiffness, damping, peelThreshold, animationDuration, autoComplete }, { request: (callback) => requestAnimationFrame(callback), cancel: (id) => cancelAnimationFrame(id) }, paint, setPhase, () => {
      if (!latest.current.authoring && !reported.current && !latest.current.restored) { reported.current = true; latest.current.onProgress?.(progressId); }
    }, reducedMotion);
    engine.current = controller; controller.reset(latest.current.restored && !replaying.current);
    return () => { releaseCapture(); controller.dispose(); engine.current = null; };
  }, [blockId, progressId, dragResistance, springStiffness, damping, peelThreshold, animationDuration, autoComplete, reducedMotion, paint, releaseCapture]);
  useEffect(() => { if (restored && !replaying.current && engine.current?.phase !== "revealed") engine.current?.reset(true); }, [restored]);
  useLayoutEffect(() => { paint(engine.current?.progress ?? (restored ? 1 : 0)); }, [phase, settings, children, restored, paint]);
  useLayoutEffect(() => {
    if (revealed && focusAfterReveal.current) { root.current?.querySelector<HTMLElement>("[data-peel-content]")?.focus({ preventScroll: true }); focusAfterReveal.current = false; }
  }, [revealed]);
  useEffect(() => {
    if (!active) { releaseCapture(); engine.current?.interrupt(); pauseMedia(); }
  }, [active, releaseCapture, pauseMedia]);
  useEffect(() => {
    const element = root.current; if (!element) return;
    const interrupt = () => { releaseCapture(); engine.current?.interrupt(); pauseMedia(); };
    const visibility = () => { if (document.hidden) interrupt(); };
    const restart = () => { interrupt(); if (settings.allowReset && settings.allowRepeat) { replaying.current = true; engine.current?.reset(); } };
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => { if (gesture.current) interrupt(); }); resize?.observe(element);
    document.addEventListener("visibilitychange", visibility); element.addEventListener(slideMediaRestartEvent, restart);
    return () => { resize?.disconnect(); document.removeEventListener("visibilitychange", visibility); element.removeEventListener(slideMediaRestartEvent, restart); pauseMedia(); };
  }, [settings.allowReset, settings.allowRepeat, pauseMedia, releaseCapture]);
  const reveal = () => { if (active) { focusAfterReveal.current = Boolean(root.current?.contains(document.activeElement)); engine.current?.reveal(); } };
  const cancel = () => { releaseCapture(); focusAfterReveal.current = false; if (engine.current?.phase === "revealing") engine.current.interrupt(); else engine.current?.release(true); };
  const finishPointer = (event: React.PointerEvent<HTMLButtonElement>) => {
    const g = gesture.current; if (!g || event.pointerId !== g.pointerId) return;
    suppressClick.current = true; releaseCapture();
    if (!g.moved && settings.trigger !== "drag") reveal(); else engine.current?.release();
  };
  const busy = phase === "revealing" || phase === "released";
  const corner = `${settings.direction.startsWith("bottom") ? "bottom-0" : "top-0"} ${settings.direction.endsWith("right") ? "right-0" : "left-0"}`;
  return <div ref={root} data-peel-to-reveal={blockId} data-phase={phase} data-interaction-status={revealed ? "completed" : phase === "idle" ? "not-started" : "in-progress"} data-slide-game-player className={presentation ? "flex h-full min-h-[240px] min-w-[280px] w-full flex-col gap-2" : "mx-auto w-full"} style={presentation ? undefined : { maxWidth: settings.cardWidth }} onKeyDown={(event) => { if (event.key === "Escape") { cancel(); event.stopPropagation(); } }}>
    <div data-peel-card className={`relative isolate w-full border border-black/5 ${presentation ? "min-h-0 flex-1" : ""}`} style={{ minHeight: presentation ? undefined : settings.cardHeight, backgroundColor: settings.backgroundColor, borderRadius: settings.cornerRadius, boxShadow: `0 8px 36px rgb(0 0 0 / ${settings.shadowIntensity / 100 * 0.15})` }}>
      <div data-peel-content tabIndex={-1} aria-hidden={!revealed} inert={!revealed} className={`${presentation ? "absolute inset-0 overflow-y-auto overscroll-contain" : "relative"} break-words p-5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 sm:p-7`} style={{ minHeight: presentation ? undefined : settings.cardHeight, borderRadius: settings.cornerRadius }}>
        {children}
      </div>
      {!revealed && <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ borderRadius: settings.cornerRadius }}><PeelSurface settings={settings} /></div>}
      {!revealed && <>
        {settings.trigger !== "drag" && <button type="button" data-peel-activation className="absolute inset-0 cursor-pointer rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-4" aria-label={`Peel to reveal: ${settings.title || "Hidden content"}`} aria-describedby={`${blockId}-peel-help`} disabled={!active || busy} onClick={reveal} style={{ touchAction: "pan-y" }} />}
        <button type="button" data-peel-handle className={`absolute z-20 grid size-16 touch-none select-none place-items-center rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-4 ${corner} ${phase === "grabbing" || phase === "peeling" ? "cursor-grabbing" : "cursor-grab"}`} style={{ color: contrastTextColor(settings.paperColor) }} aria-label={`Grab paper corner: ${settings.title || "Hidden content"}`} aria-describedby={`${blockId}-peel-help`} disabled={!active || busy}
          onPointerDown={(event) => { if (settings.trigger === "click" || event.button !== 0 || !active || gesture.current) return; if (!engine.current?.begin()) return; event.preventDefault(); event.stopPropagation(); suppressClick.current = false; const bounds = root.current!.querySelector("[data-peel-card]")!.getBoundingClientRect(); gesture.current = { pointerId: event.pointerId, start: localInteractionPoint({ x: event.clientX, y: event.clientY }, bounds), client: { x: event.clientX, y: event.clientY }, moved: false, button: event.currentTarget }; event.currentTarget.setPointerCapture?.(event.pointerId); }}
          onPointerMove={(event) => { const g = gesture.current; if (!g || event.pointerId !== g.pointerId) return; event.preventDefault(); const bounds = root.current!.querySelector("[data-peel-card]")!.getBoundingClientRect(); g.moved ||= Math.hypot(event.clientX - g.client.x, event.clientY - g.client.y) > 5; const point = localInteractionPoint({ x: event.clientX, y: event.clientY }, bounds); const start = orientPoint(g.start, settings.direction), end = orientPoint(point, settings.direction); tilt.current.target = Math.max(-1, Math.min(1, ((end.x - start.x) - (end.y - start.y)) * 1.5)); engine.current?.drag(peelDragProgress(g.start, point, settings.direction)); }}
          onPointerUp={finishPointer} onPointerCancel={cancel} onLostPointerCapture={() => { if (gesture.current) cancel(); }} onClick={(event) => { if (suppressClick.current && event.detail !== 0) { suppressClick.current = false; return; } if (event.detail === 0 || settings.trigger !== "drag") reveal(); }}>
          {settings.indicator === "grip" ? <Grip size={18} aria-hidden="true" className="opacity-50" /> : settings.indicator === "arrow" ? <CornerDownLeft size={18} aria-hidden="true" className="opacity-60" /> : <span className="sr-only">Peel corner</span>}
        </button>
      </>}
    </div>
    <div className="mt-2 flex min-h-8 items-center justify-between gap-2 text-xs text-slate-500">
      <p id={`${blockId}-peel-help`} className={settings.showInstructions ? "" : "sr-only"}>{revealed ? "Revealed. Explore the content below the paper." : settings.trigger === "click" ? "Tap the paper, or press Enter, to peel." : `Pull the ${settings.direction.replace("-", " ")} corner inward${settings.trigger === "both" ? ", or tap the paper" : ""}. Keyboard: focus the corner and press Enter.`}</p>
      <span role="status" aria-live="polite" className="sr-only">{revealed ? "Content revealed" : phase === "revealing" ? "Peeling paper" : ""}</span>
      {(revealed || authoring) && settings.allowReset && settings.allowRepeat && !decorative && <Button variant="ghost" size="sm" aria-label="Replay peel" onClick={() => { releaseCapture(); pauseMedia(); replaying.current = true; engine.current?.reset(); }}><RotateCcw size={13} aria-hidden="true" />{authoring ? "Reset preview" : "Peel again"}</Button>}
    </div>
  </div>;
}
