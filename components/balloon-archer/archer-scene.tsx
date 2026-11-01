"use client";

import { useEffect, useId, useRef, useState, type PointerEvent } from "react";
import { motion } from "framer-motion";
import { contrastTextColor, solidColor } from "@/lib/color";
import { advanceArcherShot, archerArrow, archerBalloonPosition, balloonCenter, constrainPull, launchArcherArrow, type ArcherPoint, type ArcherShot } from "@/lib/interactive/balloon-archer";
import type { ArcherBalloon, BalloonArcherData } from "@/lib/schemas/balloon-archer";

type Props = {
  data: BalloonArcherData; positions: ArcherBalloon[]; popped: ReadonlySet<string>; arranging: boolean; enabled: boolean; reducedMotion: boolean;
  pull: ArcherPoint; recoil: ArcherPoint; shot: ArcherShot | null;
  burst: { id: number; point: ArcherPoint; color?: string } | null;
  onPull: (pull: ArcherPoint) => void; onRelease: (pull: ArcherPoint) => void; onCancel: () => void;
  onReview: (id: string) => void;
  onPositionChange?: (id: string, position: ArcherPoint) => void;
};

/** Pointer coordinates are in the SVG world, including letterboxing, canvas zoom, and fullscreen. */
function scenePoint(svg: SVGSVGElement, event: { clientX: number; clientY: number }): ArcherPoint {
  const matrix = typeof svg.getScreenCTM === "function" ? svg.getScreenCTM() : null;
  if (matrix) { const point = svg.createSVGPoint(); point.x = event.clientX; point.y = event.clientY; return point.matrixTransform(matrix.inverse()); }
  const bounds = svg.getBoundingClientRect();
  const scale = Math.min(bounds.width / 800, bounds.height / 600) || 1;
  return { x: (event.clientX - bounds.left - (bounds.width - 800 * scale) / 2) / scale, y: (event.clientY - bounds.top - (bounds.height - 600 * scale)) / scale };
}

export function ArcherScene({ data, positions, popped, arranging, enabled, reducedMotion, pull, recoil, shot, burst, onPull, onRelease, onCancel, onReview, onPositionChange }: Props) {
  const fieldInk = contrastTextColor(data.backgroundColor);
  const bowColor = solidColor(data.bowColor);
  const svg = useRef<SVGSVGElement>(null);
  const glowId = `archer-glow-${useId().replaceAll(":", "")}`;
  const gesture = useRef<{ pointerId: number; kind: "arrow" | "balloon"; start: ArcherPoint; initial: ArcherPoint; balloonId?: string; pull: ArcherPoint; moved: boolean } | null>(null);
  const [draft, setDraft] = useState<{ id: string; point: ArcherPoint } | null>(null);
  useEffect(() => () => { gesture.current = null; }, [enabled, arranging, data.balloons]);
  const held = archerArrow(pull);
  const bowPull = Math.hypot(pull.x, pull.y) ? pull : recoil;
  const bend = Math.min(20, Math.hypot(bowPull.x, bowPull.y) / 5);
  const left = 310 + bend, right = 490 - bend;
  const direction = shot ? { x: shot.vx / Math.hypot(shot.vx, shot.vy), y: shot.vy / Math.hypot(shot.vx, shot.vy) } : held.direction;
  const tip = shot ?? held.tip;
  const tail = { x: tip.x - direction.x * 72, y: tip.y - direction.y * 72 };
  const trajectory = launchArcherArrow(pull);
  const points = trajectory ? Array.from({ length: 16 }, (_, index) => advanceArcherShot(trajectory, index * 0.045)).map((point) => `${point.x},${point.y}`).join(" ") : "";

  function start(event: PointerEvent<SVGGElement>, balloon?: ArcherBalloon) {
    if (event.button !== 0 || !svg.current || (!arranging && (!enabled || shot || balloon))) return;
    event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId);
    const initial = balloon ? balloonCenter(balloon) : { x: 0, y: 0 };
    gesture.current = { pointerId: event.pointerId, kind: balloon ? "balloon" : "arrow", start: scenePoint(svg.current, event), initial, balloonId: balloon?.id, pull: { x: 0, y: 0 }, moved: false };
    if (!balloon) onPull({ x: 0, y: 0 });
  }
  function move(event: PointerEvent<SVGSVGElement>) {
    const drag = gesture.current;
    if (!drag || drag.pointerId !== event.pointerId || !svg.current) return;
    event.preventDefault(); event.stopPropagation();
    const point = scenePoint(svg.current, event);
    drag.moved = true;
    if (drag.kind === "arrow") {
      drag.pull = constrainPull({ x: point.x - drag.start.x, y: point.y - drag.start.y }); onPull(drag.pull);
    } else {
      const position = archerBalloonPosition({ x: drag.initial.x + point.x - drag.start.x, y: drag.initial.y + point.y - drag.start.y });
      drag.pull = position; setDraft({ id: drag.balloonId!, point: position });
    }
  }
  function stop(event: PointerEvent<SVGSVGElement>, cancelled = false) {
    const drag = gesture.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault(); event.stopPropagation(); gesture.current = null;
    if (cancelled) { onCancel(); setDraft(null); return; }
    if (drag.kind === "arrow") onRelease(drag.pull);
    else if (drag.moved && drag.balloonId) { onPositionChange?.(drag.balloonId, drag.pull); setDraft(null); }
  }
  return <svg ref={svg} data-archer-scene viewBox="0 0 800 600" preserveAspectRatio="xMidYMax meet" className="block h-full w-full touch-none select-none" style={{ color: fieldInk }} aria-label={arranging ? "Arrange balloons on the game field" : "Balloon Archer game field"} onPointerMove={move} onPointerUp={(event) => stop(event)} onPointerCancel={(event) => stop(event, true)} onLostPointerCapture={(event) => stop(event, true)}>
    <defs><radialGradient id={glowId}><stop stopColor="white" stopOpacity="0.13" /><stop offset="1" stopColor="white" stopOpacity="0" /></radialGradient></defs>
    <ellipse cx="400" cy="280" rx="360" ry="290" fill={`url(#${glowId})`} />
    {Array.from({ length: 18 }, (_, index) => <circle key={index} cx={(index * 157 + 31) % 780 + 10} cy={(index * 73 + 23) % 410 + 10} r={index % 3 === 0 ? 2 : 1} fill="white" opacity="0.22" />)}
    <ellipse cx="400" cy="565" rx="190" ry="14" fill="black" opacity="0.16" />
    {positions.map((balloon) => {
      const position = draft?.id === balloon.id ? draft.point : balloon;
      const center = balloonCenter(position), wasPopped = !arranging && popped.has(balloon.id);
      const label = balloon.word || "Balloon";
      return <g key={balloon.id} data-archer-balloon={balloon.id} data-slide-animation-item data-popped={wasPopped || undefined} role={arranging || wasPopped ? "button" : "img"} tabIndex={arranging || wasPopped ? 0 : -1} className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-current" aria-label={`${arranging ? "Move balloon" : wasPopped ? "Review balloon" : "Balloon"}: ${label}`} style={{ cursor: arranging ? "grab" : wasPopped ? "pointer" : "default" }} onPointerDown={(event) => { if (arranging) start(event, balloon); else event.stopPropagation(); }} onClick={() => { if (!arranging && wasPopped) onReview(balloon.id); }} onKeyDown={(event) => {
        if (arranging && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
          event.preventDefault(); event.stopPropagation(); const amount = event.shiftKey ? 5 : 1;
          onPositionChange?.(balloon.id, archerBalloonPosition({ x: center.x + (event.key === "ArrowLeft" ? -amount : event.key === "ArrowRight" ? amount : 0) * 8, y: center.y + (event.key === "ArrowUp" ? -amount : event.key === "ArrowDown" ? amount : 0) * 6 }));
        }
        if (!arranging && wasPopped && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); event.stopPropagation(); onReview(balloon.id); }
        if (event.key === "Escape") { gesture.current = null; setDraft(null); onCancel(); }
      }}>
        {wasPopped ? <><circle cx={center.x} cy={center.y} r="24" fill={fieldInk} opacity="0.13" /><text x={center.x} y={center.y + 7} textAnchor="middle" fontSize="24" fill={fieldInk}>✓</text></> : <>
          <path d={`M ${center.x} ${center.y + 64} q -12 22 1 39 t -2 29`} fill="none" stroke={fieldInk} strokeOpacity="0.3" strokeWidth="1.5" />
          <ellipse cx={center.x} cy={center.y} rx="48" ry="60" fill={solidColor(balloon.color ?? data.balloonColor)} />
          <ellipse cx={center.x - 16} cy={center.y - 26} rx="12" ry="19" fill="white" opacity="0.2" transform={`rotate(25 ${center.x - 16} ${center.y - 26})`} />
          <path d={`M ${center.x - 6} ${center.y + 60} l 12 0 -6 -9 z`} fill={solidColor(balloon.color ?? data.balloonColor)} />
          <foreignObject x={center.x - 41} y={center.y - 36} width="82" height="72"><div className="grid h-full place-items-center break-words px-1 text-center font-semibold leading-tight [overflow-wrap:anywhere]" style={{ color: solidColor(data.textColor), fontSize: label.length > 24 ? 13 : label.length > 14 ? 16 : 20 }}>{label}</div></foreignObject>
        </>}
      </g>;
    })}
    {trajectory && !shot && !arranging && <polyline points={points} fill="none" stroke={fieldInk} strokeWidth="2" strokeDasharray="2 10" opacity="0.4" pointerEvents="none" />}
    {burst && !reducedMotion && <g key={burst.id} data-archer-particles pointerEvents="none">{Array.from({ length: 14 }, (_, index) => {
      const angle = index * Math.PI * 2 / 14;
      return <motion.circle key={index} initial={{ cx: burst.point.x, cy: burst.point.y, r: 5, opacity: 1 }} animate={{ cx: burst.point.x + Math.cos(angle) * (55 + index % 3 * 20), cy: burst.point.y + Math.sin(angle) * (55 + index % 3 * 20) + 25, r: 1, opacity: 0 }} transition={{ duration: 0.7, ease: "easeOut" }} fill={index % 3 ? solidColor(burst.color ?? data.balloonColor) : fieldInk} />;
    })}<motion.circle initial={{ r: 12, opacity: 0.8 }} animate={{ r: 90, opacity: 0 }} transition={{ duration: 0.45 }} cx={burst.point.x} cy={burst.point.y} fill="none" stroke={fieldInk} strokeWidth="2" /></g>}
    <g data-archer-bow aria-hidden="true" pointerEvents="none">
      <path d={`M ${left} 490 Q 352 ${529 + bend} 400 522 Q 448 ${529 + bend} ${right} 490`} fill="none" stroke={bowColor} strokeWidth="9" strokeLinecap="round" />
      <path data-archer-string d={`M ${left} 490 L ${400 + bowPull.x} ${490 + bowPull.y} L ${right} 490`} fill="none" stroke={bowColor} strokeWidth="2" />
      <path d="M 390 522 L 410 522" stroke={bowColor} strokeWidth="12" strokeLinecap="round" />
    </g>
    <g data-archer-arrow={shot ? "flying" : "ready"} role="button" tabIndex={arranging ? -1 : 0} className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-current" aria-label="Grab arrow, pull down and release to shoot" aria-disabled={arranging || !enabled || Boolean(shot)} style={{ cursor: arranging || shot ? "default" : "grab" }} onPointerDown={(event) => { if (!arranging) start(event); }} onKeyDown={(event) => {
      if (arranging || !enabled || shot) return;
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter", " ", "Escape"].includes(event.key)) { event.preventDefault(); event.stopPropagation(); }
      if (event.key === "ArrowLeft") onPull(constrainPull({ ...pull, x: pull.x + 5 }));
      if (event.key === "ArrowRight") onPull(constrainPull({ ...pull, x: pull.x - 5 }));
      if (event.key === "ArrowDown") onPull(constrainPull({ ...pull, y: pull.y + 8 }));
      if (event.key === "ArrowUp") onPull(constrainPull({ ...pull, y: pull.y - 8 }));
      if (event.key === "Enter" || event.key === " ") onRelease(pull);
      if (event.key === "Escape") onCancel();
    }}>
      <title>Keyboard: Left and Right aim, Down adds power, Up reduces power, Space or Enter shoots, Escape cancels.</title>
      <circle cx={tail.x} cy={tail.y} r="56" fill="transparent" />
      <line x1={tail.x} y1={tail.y} x2={tip.x} y2={tip.y} stroke={bowColor} strokeWidth="4" strokeLinecap="round" />
      <path d="M -7 13 L 0 0 L 7 13" transform={`translate(${tip.x} ${tip.y}) rotate(${Math.atan2(direction.y, direction.x) * 180 / Math.PI + 90})`} fill={bowColor} stroke={bowColor} strokeWidth="1" />
      <path d="M -7 -12 L -7 4 L 0 12 L 7 4 L 7 -12 L 0 -6 Z" transform={`translate(${tail.x} ${tail.y}) rotate(${Math.atan2(direction.y, direction.x) * 180 / Math.PI + 90})`} fill={bowColor} />
      {!shot && !arranging && <><circle cx={tail.x} cy={tail.y} r="22" fill="none" stroke={fieldInk} strokeOpacity="0.3" strokeWidth="1" /><text x="400" y="585" textAnchor="middle" fill={fieldInk} opacity="0.6" fontSize="14">PULL • AIM • RELEASE</text></>}
    </g>
  </svg>;
}
