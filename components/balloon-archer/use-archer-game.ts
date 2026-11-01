"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { advanceArcherShot, archerStringRecoil, archerWorld, balloonCenter, firstArcherHit, launchArcherArrow, type ArcherPoint, type ArcherShot } from "@/lib/interactive/balloon-archer";
import type { ArcherBalloon } from "@/lib/schemas/balloon-archer";

export function useArcherGame({ balloons, getTargets, popped, enabled, reducedMotion, onPop }: { balloons: ArcherBalloon[]; getTargets: () => ArcherBalloon[]; popped: ReadonlySet<string>; enabled: boolean; reducedMotion: boolean; onPop: (balloon: ArcherBalloon) => void }) {
  const [pull, setPull] = useState<ArcherPoint>({ x: 0, y: 0 });
  const [shot, setShot] = useState<ArcherShot | null>(null);
  const [recoil, setRecoil] = useState<ArcherPoint>({ x: 0, y: 0 });
  const [burst, setBurst] = useState<{ id: number; point: ArcherPoint; color?: string } | null>(null);
  const [message, setMessage] = useState("Pull down to build power, then release to shoot.");
  const frame = useRef<number | null>(null), generation = useRef(0);
  const cancel = useCallback(() => {
    generation.current++;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null; setShot(null); setPull({ x: 0, y: 0 }); setRecoil({ x: 0, y: 0 }); setBurst(null);
  }, []);
  useEffect(() => {
    const visibility = () => { if (document.hidden) cancel(); };
    document.addEventListener("visibilitychange", visibility);
    return () => { document.removeEventListener("visibilitychange", visibility); cancel(); };
  }, [balloons, enabled, cancel]);

  function fire(held = pull) {
    if (!enabled || shot) return;
    const launched = launchArcherArrow(held);
    if (!launched) { setPull({ x: 0, y: 0 }); setMessage("Pull the arrow farther down before releasing."); return; }
    cancel();
    const token = generation.current;
    let projectile: ArcherShot | null = launched;
    let previous = performance.now(), elapsed = 0;
    let previousTargets = getTargets();
    let burstAt: number | null = null;
    setShot(launched); setMessage("Arrow in flight…");
    const tick = (now: number) => {
      if (token !== generation.current) return;
      const seconds = Math.max(0, Math.min((now - previous) / 1000, 0.04)); previous = now; elapsed += seconds;
      setRecoil(reducedMotion || elapsed > 0.7 ? { x: 0, y: 0 } : archerStringRecoil(held, elapsed));
      if (projectile) {
        const next = advanceArcherShot(projectile, seconds);
        const targets = getTargets();
        const hit = firstArcherHit(projectile, next, targets.filter((balloon) => !popped.has(balloon.id)), previousTargets);
        previousTargets = targets;
        if (hit) {
          projectile = null; setShot(null); onPop(hit); setMessage(`Popped ${hit.word || "balloon"}. Read the revealed text.`);
          if (!reducedMotion) { setBurst({ id: token, point: balloonCenter(hit), color: hit.color }); burstAt = elapsed; }
        } else if (next.x < -100 || next.x > archerWorld.width + 100 || next.y < -100 || next.y > archerWorld.height + 100 || elapsed > 4) {
          projectile = null; setShot(null); setMessage("Try again. Pull farther for more power and move sideways to aim.");
        } else { projectile = next; setShot(next); }
      }
      if (burstAt !== null && elapsed - burstAt > 0.8) { setBurst(null); burstAt = null; }
      if (projectile || elapsed < 0.7 || burstAt !== null) frame.current = requestAnimationFrame(tick);
      else { frame.current = null; setRecoil({ x: 0, y: 0 }); }
    };
    frame.current = requestAnimationFrame(tick);
  }
  return { pull, setPull, shot, recoil, burst, message, setMessage, fire, cancel };
}
