"use client";
import { useMemo, useSyncExternalStore } from "react";
import { defaultTimelinePreferences, parseTimelinePreferences, type TimelinePreferences } from "@/lib/slides/timeline-preferences";

const changedEvent = "coursecraft:timeline-preferences";
/** Browser workspace preferences never enter the revisioned slide document. */
function createStore(key: string) {
  let value = defaultTimelinePreferences, stored: string | null = null;
  function read() {
    if (typeof window === "undefined") return defaultTimelinePreferences;
    try { const next = localStorage.getItem(key); if (next !== stored) { stored = next; value = parseTimelinePreferences(next ? JSON.parse(next) : {}); } }
    catch { /* Use the current tab's preferences when browser storage is unavailable. */ }
    return value;
  }
  return {
    read, server: () => defaultTimelinePreferences,
    subscribe: (listener: () => void) => {
      const storage = (event: StorageEvent) => { if (event.key === key || event.key === null) listener(); };
      const changed = (event: Event) => { if ((event as CustomEvent<string>).detail === key) listener(); };
      window.addEventListener("storage", storage); window.addEventListener(changedEvent, changed);
      return () => { window.removeEventListener("storage", storage); window.removeEventListener(changedEvent, changed); };
    },
    update: (patch: Partial<TimelinePreferences>) => {
      value = parseTimelinePreferences({ ...read(), ...patch });
      const next = JSON.stringify(value);
      try { localStorage.setItem(key, next); stored = next; } catch { /* Editing still works without storage. */ }
      window.dispatchEvent(new CustomEvent(changedEvent, { detail: key }));
    },
  };
}
export function useTimelinePreferences(key: string) {
  const store = useMemo(() => createStore(key), [key]);
  return { value: useSyncExternalStore(store.subscribe, store.read, store.server), update: store.update };
}
