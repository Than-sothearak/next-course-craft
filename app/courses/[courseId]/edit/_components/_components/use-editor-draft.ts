"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { EditorSnapshotInput } from "@/lib/editor/schemas";

export type Draft = Omit<EditorSnapshotInput, "revision">;

export function useEditorDraft({ initialDraft, initialRevision, courseId, titleValid, titleValidRef, onNavigate }: {
  initialDraft: Draft; initialRevision: number; courseId: string; titleValid: boolean; titleValidRef: RefObject<boolean>; onNavigate: (path: string) => void;
}) {
  const [draft, setDraft] = useState(initialDraft);

  const draftRef = useRef(draft);

  const revisionRef = useRef(initialRevision);

  const lastSavedRef = useRef(JSON.stringify(initialDraft));

  const saveInFlight = useRef(false);

  const savePending = useRef(false);

  const pendingRouteRef = useRef<string | null>(null);

  const conflictRef = useRef(false);

  const historyRef = useRef<Draft[]>([]);

  const redoRef = useRef<Draft[]>([]);

  const [canUndo, setCanUndo] = useState(false);

  const [canRedo, setCanRedo] = useState(false);

  const [saveState, setSaveState] = useState<
    "saved" | "saving" | "error" | "conflict"
  >("saved");

  const [saveMessage, setSaveMessage] = useState("");

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  function commit(next: Draft) {
    if (JSON.stringify(next) === JSON.stringify(draftRef.current)) return;
    historyRef.current = [...historyRef.current.slice(-79), draftRef.current];
    redoRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
    draftRef.current = next;
    setDraft(next);
    setHasUnsavedChanges(JSON.stringify(next) !== lastSavedRef.current);
  }

  function updateDraft(update: (current: Draft) => Draft) {
    commit(update(draftRef.current));
  }

  function openRouteAfterSave(path: string) {
    if (
      JSON.stringify(draftRef.current) === lastSavedRef.current &&
      !saveInFlight.current
    ) {
      onNavigate(path);
      return;
    }
    pendingRouteRef.current = path;
    void saveLatest();
  }

  function undo() {
    const previous = historyRef.current.pop();
    if (!previous) return;
    redoRef.current.push(draftRef.current);
    setCanUndo(historyRef.current.length > 0);
    setCanRedo(true);
    draftRef.current = previous;
    setDraft(previous);
    setHasUnsavedChanges(JSON.stringify(previous) !== lastSavedRef.current);
  }

  function redo() {
    const next = redoRef.current.pop();
    if (!next) return;
    historyRef.current.push(draftRef.current);
    setCanUndo(true);
    setCanRedo(redoRef.current.length > 0);
    draftRef.current = next;
    setDraft(next);
    setHasUnsavedChanges(JSON.stringify(next) !== lastSavedRef.current);
  }

  async function saveLatest() {
    if (conflictRef.current || !titleValidRef.current) return;
    if (saveInFlight.current) {
      savePending.current = true;
      return;
    }
    const snapshot = draftRef.current;
    const serialized = JSON.stringify(snapshot);
    if (serialized === lastSavedRef.current) return;
    saveInFlight.current = true;
    setSaveState("saving");
    setSaveMessage("");
    try {
      const response = await fetch(
        `/api/courses/${courseId}/editor`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...snapshot, revision: revisionRef.current }),
        },
      );
      const result = await response.json();
      if (response.status === 409) {
        conflictRef.current = true;
        setSaveState("conflict");
        setSaveMessage(
          result.error ?? "This course changed elsewhere. Reload to continue.",
        );
        return;
      }
      if (!response.ok)
        throw new Error(result.error ?? "Your changes could not be saved.");
      revisionRef.current = result.revision;
      lastSavedRef.current = serialized;
      setHasUnsavedChanges(JSON.stringify(draftRef.current) !== serialized);
      setSaveState("saved");
      const pendingRoute = pendingRouteRef.current;
      if (pendingRoute && JSON.stringify(draftRef.current) === serialized) {
        pendingRouteRef.current = null;
        onNavigate(pendingRoute);
      }
    } catch (error) {
      setSaveState("error");
      setSaveMessage(
        error instanceof Error
          ? error.message
          : "Your changes could not be saved.",
      );
    } finally {
      saveInFlight.current = false;
      const saveAgain = savePending.current;
      savePending.current = false;
      // A draft may have changed after this request captured its snapshot. Do
      // not rely on a second debounce timer having fired while the request was
      // in flight; immediately queue the latest version after this save ends.
      const hasUnsavedChanges =
        JSON.stringify(draftRef.current) !== lastSavedRef.current;
      if ((saveAgain || hasUnsavedChanges) && !conflictRef.current) {
        window.setTimeout(
          () => void saveLatest(),
          hasUnsavedChanges ? 250 : 500,
        );
      }
    }
  }

  useEffect(() => {
    if (
      JSON.stringify(draft) === lastSavedRef.current ||
      saveState === "conflict"
    )
      return;
    const timer = window.setTimeout(() => void saveLatest(), 700);
    return () => window.clearTimeout(timer);
    // saveLatest reads the current draft from a ref so saves stay serialized.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, saveState, titleValid]);

  function clearSaveError() {
    if (saveState === "error") {
      setSaveState("saved");
      setSaveMessage("");
    }
  }

  return { draft, draftRef, pendingRouteRef, canUndo, canRedo, saveState, saveMessage, hasUnsavedChanges, updateDraft, openRouteAfterSave, undo, redo, saveLatest, clearSaveError };
}
