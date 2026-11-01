"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import { Check, GripHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { colorWithOpacity, contrastTextColor } from "@/lib/color";
import { PhysicsInteraction, type InteractionPhase } from "@/lib/interactive/physics/engine";
import { RopeMotion, ropePath, ropeRest, ropeTarget, ropeTargetHit, type RopeBody, type RopePoint } from "@/lib/interactive/physics/rope";
import type { HangingRopeCard } from "@/lib/schemas/block";
import type { HangingRopeSettings } from "@/lib/schemas/hanging-rope-cards";

/** Convert screen coordinates through the SVG matrix, including slide zoom and letterboxing. */
export function ropePointerPoint(svg: SVGSVGElement, client: RopePoint): RopePoint {
  const matrix = svg.getScreenCTM?.();
  if (matrix && typeof svg.createSVGPoint === "function") { const point = svg.createSVGPoint(); point.x = client.x; point.y = client.y; const local = point.matrixTransform(matrix.inverse()); return { x: local.x, y: local.y }; }
  const bounds = svg.getBoundingClientRect(), scale = Math.min(bounds.width / 280, bounds.height / 440) || 1;
  return { x: (client.x - bounds.left - (bounds.width - 280 * scale) / 2) / scale, y: (client.y - bounds.top) / scale };
}

export function RopeCardScene({ card, settings, completed, enabled, reducedMotion, replayToken, onComplete, onReview }: {
  card: HangingRopeCard; settings: HangingRopeSettings; completed: boolean; enabled: boolean; reducedMotion: boolean; replayToken: number; onComplete: () => void; onReview: () => void;
}) {
  const root = useRef<SVGSVGElement>(null), motion = useRef<RopeMotion | null>(null), reveal = useRef<PhysicsInteraction | null>(null);
  const gesture = useRef<{ id: number; start: RopePoint; body: RopePoint; moved: boolean; button: HTMLButtonElement } | null>(null);
  const suppressClick = useRef(false), near = useRef(false);
  const [phase, setPhase] = useState<InteractionPhase>(completed ? "revealed" : "idle"), [atTarget, setAtTarget] = useState(false);
  const callbacks = useRef({ onComplete, onReview, completed });
  useLayoutEffect(() => { callbacks.current = { onComplete, onReview, completed }; }, [onComplete, onReview, completed]);
  const uid = useId().replace(/:/g, ""), target = ropeTarget(card), initial = { ...ropeRest(settings), vx: 0, vy: 0 };
  const targetRef = useRef(target);
  useLayoutEffect(() => { targetRef.current = target; });
  const targetInk = contrastTextColor(settings.backgroundColor);
  const releaseCapture = useCallback(() => { const g = gesture.current; gesture.current = null; if (g?.button.hasPointerCapture?.(g.id)) g.button.releasePointerCapture(g.id); }, []);
  const paintBody = useCallback((body: RopeBody) => {
    const svg = root.current; if (!svg) return;
    const path = ropePath(body, settings), angle = Math.max(-20, Math.min(20, (body.x - 140) * .14 - body.vx * .045));
    svg.querySelectorAll("[data-rope-strand]").forEach((element) => element.setAttribute("d", path));
    svg.querySelector("[data-rope-body]")?.setAttribute("transform", `translate(${body.x} ${body.y}) rotate(${angle})`);
    svg.setAttribute("data-card-x", body.x.toFixed(3)); svg.setAttribute("data-card-y", body.y.toFixed(3));
    const hit = ropeTargetHit(body, targetRef.current, settings.targetRadius);
    if (hit !== near.current) { near.current = hit; setAtTarget(hit); }
  }, [settings]);
  const paintReveal = useCallback((progress: number) => {
    const svg = root.current; if (!svg) return;
    svg.setAttribute("data-reveal-progress", progress.toFixed(4));
    const element = svg.querySelector<HTMLElement>("[data-rope-flip]");
    if (element) element.style.transform = settings.revealMode === "flip" ? `rotateY(${progress * 180}deg)` : `scale(${1 + Math.sin(progress * Math.PI) * .06})`;
  }, [settings.revealMode]);
  const { ropeLength, springStiffness, damping, dragResistance, maxStretch, targetRadius, animationDuration } = settings;
  // Controllers live outside React rendering; only lifecycle and target-entry changes update React.
  useEffect(() => {
    const clock = { request: (callback: (time: number) => void) => requestAnimationFrame(callback), cancel: (id: number) => cancelAnimationFrame(id) };
    const body = new RopeMotion(settings, targetRef.current, clock, paintBody, reducedMotion);
    const flip = new PhysicsInteraction({ dragResistance: 0, springStiffness, damping: Math.max(18, damping), peelThreshold: .5, animationDuration, autoComplete: true }, clock, paintReveal, setPhase, () => callbacks.current.onComplete(), reducedMotion);
    motion.current = body; reveal.current = flip; body.reset(callbacks.current.completed); flip.reset(callbacks.current.completed);
    return () => { releaseCapture(); body.dispose(); flip.dispose(); motion.current = null; reveal.current = null; };
  }, [card.id, ropeLength, springStiffness, damping, dragResistance, maxStretch, targetRadius, animationDuration, settings, reducedMotion, paintBody, paintReveal, releaseCapture, replayToken]);
  useEffect(() => { if (completed) { motion.current?.reset(true); reveal.current?.reset(true); } }, [completed]);
  useEffect(() => {
    if (!enabled) { releaseCapture(); motion.current?.interrupt(callbacks.current.completed); reveal.current?.interrupt(); }
  }, [enabled, releaseCapture]);
  useEffect(() => {
    const interrupt = () => { if (document.hidden) { releaseCapture(); motion.current?.interrupt(callbacks.current.completed); reveal.current?.interrupt(); } };
    const element = root.current;
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => { if (gesture.current) { releaseCapture(); motion.current?.interrupt(callbacks.current.completed); reveal.current?.interrupt(); } });
    if (element) resize?.observe(element); document.addEventListener("visibilitychange", interrupt);
    return () => { resize?.disconnect(); document.removeEventListener("visibilitychange", interrupt); };
  }, [releaseCapture]);
  useLayoutEffect(() => { if (motion.current) paintBody(motion.current.body); if (reveal.current) paintReveal(reveal.current.progress); }, [phase, atTarget, card, paintBody, paintReveal]);
  const activate = () => {
    if (!enabled || phase === "revealing") return;
    if (completed || phase === "revealed") { callbacks.current.onReview(); return; }
    motion.current?.dock(); reveal.current?.reveal();
  };
  const cancel = () => { releaseCapture(); if (reveal.current?.phase === "revealing") motion.current?.interrupt(completed); else motion.current?.release(true); reveal.current?.interrupt(); };
  const finish = (event: PointerEvent<HTMLButtonElement>) => {
    const g = gesture.current; if (!g || event.pointerId !== g.id) return;
    suppressClick.current = true; releaseCapture();
    // Ordinary taps leave physical play intact; Enter/Space offer an accessible automatic pull.
    if (motion.current?.release()) reveal.current?.reveal();
    else reveal.current?.release(true);
  };
  return <svg ref={root} data-rope-scene={card.id} data-phase={phase} data-completed={completed || phase === "revealed" || undefined} viewBox="0 0 280 440" preserveAspectRatio="xMidYMin meet" className="block h-full min-h-0 w-full overflow-visible" role="group" aria-label={`Hanging card: ${card.title || "Discovery"}`}>
    <defs><radialGradient id={`${uid}-glow`}><stop stopColor={settings.accentColor} stopOpacity=".25" /><stop offset="1" stopColor={settings.accentColor} stopOpacity="0" /></radialGradient></defs>
    <path d="M38 22H242" fill="none" stroke={settings.ropeColor} strokeOpacity=".15" strokeWidth="2" />
    <circle cx="140" cy="22" r="6" fill={settings.ropeColor} /><circle cx="140" cy="22" r="2" fill="white" fillOpacity=".75" />
    <g data-rope-target={card.id} data-ready={atTarget || undefined}>
      <circle cx={target.x} cy={target.y} r={atTarget ? 54 : 47} fill={`url(#${uid}-glow)`} />
      <circle cx={target.x} cy={target.y} r={settings.targetRadius} fill={colorWithOpacity(settings.accentColor, atTarget ? 18 : 5)} stroke={settings.accentColor} strokeWidth={atTarget ? 2.5 : 1.5} strokeDasharray={atTarget || completed ? undefined : "3 5"} />
      <circle cx={target.x} cy={target.y} r="6" fill={settings.accentColor} />
      <text x={target.x} y={target.y + settings.targetRadius + 17} textAnchor="middle" fill={targetInk} opacity=".55" fontSize="10">{completed ? "Discovered" : atTarget ? "Release to discover" : "Pull card here"}</text>
    </g>
    <path data-rope-strand d={ropePath(initial, settings)} fill="none" stroke="#000000" strokeOpacity=".1" strokeWidth={settings.ropeThickness + 2} transform="translate(1 2)" />
    <path data-rope-strand d={ropePath(initial, settings)} fill="none" stroke={settings.ropeColor} strokeWidth={settings.ropeThickness} strokeLinecap="round" />
    <path data-rope-strand d={ropePath(initial, settings)} fill="none" stroke="#ffffff" strokeOpacity=".4" strokeWidth={settings.ropeThickness * .35} strokeDasharray="2 3" />
    <g data-rope-body transform={`translate(${initial.x} ${initial.y})`}>
      <foreignObject x="-93" y="-80" width="186" height="170" style={{ overflow: "visible" }}>
        <div style={{ width: 176, height: 150, margin: 5, perspective: 800 }}>
          <Button data-rope-card-button variant="ghost" disabled={!enabled} aria-busy={phase === "revealing"} aria-label={`${completed ? "Review" : "Pull"} rope card: ${card.title || "Discovery"}`} aria-describedby={`${uid}-help`} className="relative block h-full w-full touch-none select-none whitespace-normal rounded-2xl border border-black/10 p-0 text-center shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-4" style={{ cursor: phase === "grabbing" ? "grabbing" : phase === "revealing" ? "progress" : "grab", backgroundColor: "transparent" }}
            onPointerDown={(event) => { if (event.button === 0) suppressClick.current = false; if (!enabled || completed || phase === "revealing" || event.button !== 0 || gesture.current || !motion.current?.begin()) return; event.preventDefault(); event.stopPropagation(); gesture.current = { id: event.pointerId, start: ropePointerPoint(root.current!, { x: event.clientX, y: event.clientY }), body: { ...motion.current.body }, moved: false, button: event.currentTarget }; event.currentTarget.setPointerCapture?.(event.pointerId); reveal.current?.begin(); }}
            onPointerMove={(event) => { const g = gesture.current; if (!g || event.pointerId !== g.id) return; event.preventDefault(); const point = ropePointerPoint(root.current!, { x: event.clientX, y: event.clientY }); g.moved ||= Math.hypot(point.x - g.start.x, point.y - g.start.y) > 4; motion.current?.drag({ x: g.body.x + point.x - g.start.x, y: g.body.y + point.y - g.start.y }); }}
            onPointerUp={finish} onPointerCancel={cancel} onLostPointerCapture={() => { if (gesture.current) cancel(); }}
            onKeyDown={(event) => { if (event.key.startsWith("Arrow")) event.stopPropagation(); if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); cancel(); } }}
            onClick={(event) => { if (suppressClick.current && event.detail !== 0) { suppressClick.current = false; return; } if (completed || event.detail === 0) activate(); }}>
            <div data-rope-flip className="absolute inset-0 rounded-[inherit]" style={{ transformStyle: "preserve-3d" }}>
              <div data-rope-front className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-[inherit] p-4" style={{ backgroundColor: card.color ?? settings.cardColor, color: settings.textColor, backfaceVisibility: "hidden" }}><span className="absolute left-1/2 top-2 size-2 -translate-x-1/2 rounded-full border border-black/15 bg-black/5" /><GripHorizontal size={16} aria-hidden="true" className="opacity-30" /><span className="line-clamp-3 text-base font-semibold leading-5">{card.title || "Discovery"}</span><span className="line-clamp-2 text-[10px] font-normal leading-4 opacity-60">{card.description}</span></div>
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-[inherit] p-4" style={{ backgroundColor: settings.accentColor, color: contrastTextColor(settings.accentColor), backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}><Check size={24} aria-hidden="true" /><span className="line-clamp-3 text-base font-semibold leading-5">{card.title || "Discovery"}</span><span className="text-[10px] font-normal">Open discovery</span></div>
            </div>
          </Button>
        </div>
      </foreignObject>
    </g>
    <desc id={`${uid}-help`}>Pull the card onto its glowing point and release. Keyboard: focus the card and press Enter or Space to pull automatically. Escape cancels.</desc>
  </svg>;
}
