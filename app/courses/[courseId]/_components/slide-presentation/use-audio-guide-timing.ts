"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { defaultSlideAnimation } from "@/lib/editor/slide-animation";
import type { AudioInstructionGuide } from "@/lib/editor/audio-instruction-guide";

const hidden = { visible: false, open: false, starting: false };
type Phase = "idle" | "pending-before" | "before" | "pending-with" | "with" | "playing" | "pending-after" | "after";

/** Coordinate guide visibility with media events; all pending work belongs to one playback cycle. */
export function useAudioGuideTiming(guide: AudioInstructionGuide | undefined, source: string, active: boolean, authoring: boolean) {
  const enabled = Boolean(guide?.enabled && source && (active || authoring));
  const timing = guide?.timing ?? "with";
  const { effect, duration, delay } = guide?.animation ?? defaultSlideAnimation;
  const [state, setState] = useState(hidden);
  const timers = useRef<Partial<Record<"popup" | "audio", ReturnType<typeof setTimeout>>>>({});
  const cycle = useRef(0), ready = useRef(false), phase = useRef<Phase>("idle");
  const clear = useCallback(() => {
    cycle.current++;
    Object.values(timers.current).forEach(clearTimeout);
    timers.current = {};
  }, []);
  const schedule = useCallback((slot: "popup" | "audio", wait: number, callback: () => void) => {
    const generation = cycle.current;
    if (wait === 0) { callback(); return; }
    timers.current[slot] = setTimeout(() => { delete timers.current[slot]; if (generation === cycle.current) callback(); }, wait);
  }, []);
  useLayoutEffect(() => {
    clear(); ready.current = false; phase.current = "idle"; setState(hidden);
    return clear;
  }, [clear, enabled, source, timing, effect, duration, delay, active, authoring]);

  const requestPlay = useCallback((play: () => void, restart = false) => {
    clear();
    if (restart) ready.current = false;
    if (!enabled || timing !== "before") { phase.current = "idle"; setState(hidden); play(); return; }
    if (ready.current) { phase.current = "before"; setState({ visible: true, open: true, starting: false }); play(); return; }
    phase.current = "pending-before"; setState({ ...hidden, starting: true });
    schedule("popup", delay, () => {
      phase.current = "before"; setState({ visible: true, open: true, starting: true });
      const entrance = effect === "none" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 0 : duration;
      schedule("audio", entrance, () => { ready.current = true; setState((current) => ({ ...current, starting: false })); play(); });
    });
  }, [clear, enabled, timing, schedule, delay, effect, duration]);
  const playing = useCallback(() => {
    if (!enabled) return;
    if (timing === "before") {
      clear(); ready.current = true; phase.current = "before";
      setState((current) => ({ visible: true, open: current.visible ? current.open : true, starting: false })); return;
    }
    if (timing === "after") { clear(); phase.current = "playing"; setState(hidden); return; }
    if (phase.current === "pending-with" || phase.current === "with") return;
    clear(); phase.current = "pending-with"; setState(hidden);
    schedule("popup", delay, () => { phase.current = "with"; setState({ visible: true, open: true, starting: false }); });
  }, [clear, enabled, timing, schedule, delay]);
  const ended = useCallback(() => {
    clear(); ready.current = false;
    if (!enabled || timing !== "after") { phase.current = "idle"; setState(hidden); return; }
    phase.current = "pending-after"; setState(hidden);
    schedule("popup", delay, () => { phase.current = "after"; setState({ visible: true, open: true, starting: false }); });
  }, [clear, enabled, timing, schedule, delay]);
  const pause = useCallback(() => {
    if (phase.current === "pending-after" || phase.current === "after") return;
    clear(); phase.current = "idle"; setState(hidden);
  }, [clear]);
  const failed = useCallback(() => {
    clear();
    // A completed before-audio guide remains readable if the browser rejects playback.
    if (enabled && timing === "before" && ready.current) { phase.current = "before"; setState((current) => ({ ...current, starting: false })); return; }
    ready.current = false; phase.current = "idle"; setState(hidden);
  }, [clear, enabled, timing]);
  const error = useCallback(() => { clear(); ready.current = false; phase.current = "idle"; setState(hidden); }, [clear]);
  const close = useCallback(() => setState((current) => ({ ...current, open: false })), []);
  const reopen = useCallback(() => setState((current) => ({ ...current, open: true })), []);
  return { ...state, requestPlay, playing, ended, pause, failed, error, close, reopen };
}
