"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { advanceArcherBalloons, archerMovingTargets, createArcherBalloonBodies } from "@/lib/interactive/archer-balloon-motion";
import type { ArcherBalloon } from "@/lib/schemas/balloon-archer";

export function useArcherBalloons(balloons: ArcherBalloon[], popped: ReadonlySet<string>, enabled: boolean, reducedMotion: boolean) {
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 4294967296));
  const [motion, setMotion] = useState({ source: balloons, targets: balloons });
  const targets = useRef(balloons), poppedRef = useRef(popped);
  useEffect(() => { poppedRef.current = popped; }, [popped]);
  useEffect(() => {
    targets.current = balloons;
    if (!enabled || reducedMotion) return;
    let bodies = createArcherBalloonBodies(balloons, seed), previous = performance.now(), elapsed = 0;
    let frame: number | null = null;
    const tick = (now: number) => {
      frame = null;
      const seconds = Math.max(0, Math.min((now - previous) / 1000, 0.04)); previous = now;
      if (!document.hidden) {
        bodies = advanceArcherBalloons(bodies, elapsed, seconds, poppedRef.current); elapsed += seconds;
        const current = archerMovingTargets(balloons, bodies); targets.current = current; setMotion({ source: balloons, targets: current });
      }
      if (!document.hidden && poppedRef.current.size < balloons.length) frame = requestAnimationFrame(tick);
    };
    const visibility = () => {
      if (document.hidden && frame !== null) { cancelAnimationFrame(frame); frame = null; }
      else if (!document.hidden && frame === null && poppedRef.current.size < balloons.length) { previous = performance.now(); frame = requestAnimationFrame(tick); }
    };
    document.addEventListener("visibilitychange", visibility);
    visibility();
    return () => { if (frame !== null) cancelAnimationFrame(frame); document.removeEventListener("visibilitychange", visibility); targets.current = balloons; };
  }, [balloons, enabled, reducedMotion, seed]);
  const getTargets = useCallback(() => targets.current, []);
  const restart = useCallback(() => setSeed((current) => (current + 2654435761) >>> 0), []);
  return { targets: enabled && !reducedMotion && motion.source === balloons ? motion.targets : balloons, getTargets, restart };
}
