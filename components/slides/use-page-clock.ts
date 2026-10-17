"use client";
import { useEffect, useRef, useState } from "react";

export function usePageClock(duration: number, loop = false) {
  const [{ time, playing, epoch }, setClock] = useState({ time: 0, playing: false, epoch: 0 });
  const timeRef = useRef(time);
  useEffect(() => { timeRef.current = time; }, [time]);
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const initial = timeRef.current, started = performance.now();
    const tick = (now: number) => {
      const elapsed = initial + (now - started) / 1_000;
      const next = loop && duration > 0 ? elapsed % duration : Math.min(duration, elapsed);
      setClock((current) => current.playing ? { ...current, time: next, playing: loop || next < duration } : current);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration, playing, loop, epoch]);
  return { time, playing, seek: (value: number) => { if (Number.isFinite(value)) setClock((current) => ({ ...current, epoch: current.epoch + 1, time: Math.max(0, Math.min(duration, value)) })); }, toggle: () => setClock((current) => ({ ...current, time: current.time >= duration ? 0 : current.time, playing: !current.playing })), pause: () => setClock((current) => ({ ...current, playing: false })) };
}
