"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { SlideDraftStore, type RevisionedDraft } from "@/lib/slides/draft-store";
import { slideRecordSchema, slideSnapshotSchema, type SlideRecord } from "@/lib/slides/schema";
import { slideThemeUpdateSchema, type SlideThemeSnapshot } from "@/lib/slides/themes";
import type { SlideTemplateId } from "@/lib/slides/template-definitions";

export async function slideResponseJson(response: Response): Promise<unknown> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw Object.assign(new Error(body.error || "The request failed. Please try again."), { status: response.status });
  }
  return response.status === 204 ? null : response.json();
}
function useDraftAutosave<T extends RevisionedDraft>(store: SlideDraftStore<T>) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  useEffect(() => {
    if (!snapshot.dirtyIds.length || snapshot.saving || snapshot.failure) return;
    const timer = window.setTimeout(() => void store.flush(), 900);
    return () => window.clearTimeout(timer);
  }, [snapshot, store]);
  return snapshot;
}
type ThemeDraft = SlideThemeSnapshot & { id: string };

export function useSlideWorkspace(courseId: string, initialSlides: SlideRecord[], initialTheme: SlideThemeSnapshot) {
  const apiPath = `/api/courses/${courseId}/slides`;
  const [slides] = useState(() => new SlideDraftStore(initialSlides, async (value) => {
    const { id, ...snapshot } = value;
    const validated = slideSnapshotSchema.safeParse(snapshot);
    if (!validated.success) throw Object.assign(new Error(validated.error.issues.map((issue) => issue.message).join(" ")), { status: 400 });
    const response = await fetch(`${apiPath}/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(validated.data) });
    return slideRecordSchema.parse(await slideResponseJson(response));
  }));
  const [themes] = useState(() => new SlideDraftStore<ThemeDraft>([{ ...initialTheme, id: "theme" }], async (value) => {
    const response = await fetch(`${apiPath}/theme`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ theme: value.theme, revision: value.revision }) });
    return { ...slideThemeUpdateSchema.parse(await slideResponseJson(response)), id: "theme" };
  }));
  const slideState = useDraftAutosave(slides), themeState = useDraftAutosave(themes);
  const [busy, setBusy] = useState(false), [operationError, setOperationError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const dirty = Boolean(slideState.dirtyIds.length || themeState.dirtyIds.length);
  const pending = dirty || slideState.saving || themeState.saving;
  useEffect(() => {
    if (!pending) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pending]);
  const saveAll = useCallback(async (retry = false) => {
    const results = await Promise.all([slides.flush(retry), themes.flush(retry)]);
    return results.every(Boolean);
  }, [slides, themes]);
  async function loadSlides() {
    const response = await fetch(apiPath, { cache: "no-store" });
    return slideRecordSchema.array().parse(await slideResponseJson(response));
  }
  async function mutate(action: () => Promise<string | null>) {
    if (busyRef.current) return null;
    busyRef.current = true; setBusy(true); setOperationError(null);
    try {
      if (!await saveAll()) return null;
      const id = await action();
      slides.sync(await loadSlides());
      return id;
    } catch (cause) { setOperationError(cause instanceof Error ? cause.message : "Could not update slides."); return null; }
    finally { busyRef.current = false; setBusy(false); }
  }
  async function addSlide(templateId: SlideTemplateId | null) {
    return mutate(async () => {
      const response = await fetch(apiPath, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ templateId }) });
      return slideRecordSchema.parse(await slideResponseJson(response)).id;
    });
  }
  async function duplicateSlide(id: string) {
    return mutate(async () => slideRecordSchema.parse(await slideResponseJson(await fetch(`${apiPath}/${id}/duplicate`, { method: "POST" }))).id);
  }
  async function deleteSlide(id: string) {
    return mutate(async () => { await slideResponseJson(await fetch(`${apiPath}/${id}`, { method: "DELETE" })); return id; });
  }
  async function moveSlide(id: string, direction: -1 | 1) {
    return mutate(async () => {
      const ordered = [...slides.getSnapshot().items].sort((a, b) => a.order - b.order);
      const index = ordered.findIndex((slide) => slide.id === id), next = index + direction;
      if (next < 0 || next >= ordered.length) return null;
      [ordered[index], ordered[next]] = [ordered[next], ordered[index]];
      await slideResponseJson(await fetch(`${apiPath}/reorder`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slideIds: ordered.map((slide) => slide.id) }) }));
      return id;
    });
  }
  async function reloadSaved() {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true);
    try {
      const [items, theme] = await Promise.all([loadSlides(), fetch(`${apiPath}/theme`, { cache: "no-store" }).then(slideResponseJson).then((value) => slideThemeUpdateSchema.parse(value))]);
      slides.sync(items); themes.sync([{ ...theme, id: "theme" }]); setOperationError(null);
    } catch (cause) { setOperationError(cause instanceof Error ? cause.message : "Could not reload slides."); }
    finally { busyRef.current = false; setBusy(false); }
  }
  return {
    slides, themes, slideState, themeState, theme: themeState.items[0].theme,
    items: [...slideState.items].sort((a, b) => a.order - b.order),
    busy, dirty, saving: slideState.saving || themeState.saving,
    failure: slideState.failure ?? themeState.failure, operationError,
    saveAll, addSlide, duplicateSlide, deleteSlide, moveSlide, reloadSaved,
  };
}
