"use client";
import { useEffect, useRef, useState } from "react";
import { useGenerationLeaveGuard } from "@/lib/editor/use-generation-leave-guard";
import type { EditorSnapshotInput } from "@/lib/editor/schemas";
import type { GenerationSessionSnapshot } from "@/lib/ai/course-generation-session-schema";
import type { useEditorDraft } from "./use-editor-draft";
import { sessionRequest, SessionRequestError, type SavedSessionResponse } from "../(editor_client_components)/generation-session-request";

export function useCourseGenerationSession(courseId: string, runServerMutation: ReturnType<typeof useEditorDraft>["runServerMutation"], enabled = true) {
  const [session, setSession] = useState<GenerationSessionSnapshot | null>(null);
  const [running, setRunning] = useState(false);
  const [progressVisible, setProgressVisible] = useState(false);
  const [error, setError] = useState("");
  const activeSaveRef = useRef<Promise<SavedSessionResponse> | null>(null);
  const [retry, setRetry] = useState(0);
  const mutationRef = useRef(runServerMutation);
  useEffect(() => { mutationRef.current = runServerMutation; });
  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    void sessionRequest<GenerationSessionSnapshot | null>(courseId).then((value) => {
      if (!disposed) {
        setSession(value);
        let dismissed = false;
        try { dismissed = Boolean(value && window.localStorage.getItem(`course-generation-progress-dismissed:${courseId}:${value.id}`)); } catch { /* Storage is optional. */ }
        setProgressVisible(value?.status === "generating" && !dismissed);
      }
    }).catch((error: unknown) => {
      if (!disposed) { setError(error instanceof Error ? error.message : "Could not restore generation progress."); setProgressVisible(true); }
    });
    return () => { disposed = true; };
  }, [courseId, enabled]);
  const sessionId = enabled && session?.status === "generating" ? session.id : null;
  const confirmLeave = useGenerationLeaveGuard(Boolean(sessionId));
  useEffect(() => {
    if (!sessionId) return;
    let disposed = false;
    const controller = new AbortController();
    async function run() {
      setRunning(true);
      setError("");
      try {
        const restored = await sessionRequest<GenerationSessionSnapshot | null>(courseId, undefined, controller.signal);
        if (!restored) throw new Error("Generation session expired. Your saved lessons remain in the course.");
        let current: GenerationSessionSnapshot = restored;
        if (current.error && retry === 0) { setSession(current); setError(current.error); return; }
        const synchronizeEditor = () => mutationRef.current(async () => {
          const response = await fetch(`/api/courses/${courseId}/editor`, { cache: "no-store", signal: controller.signal });
          if (!response.ok) throw new Error("Could not synchronize saved lessons. Reload before resuming.");
          return { editor: await response.json() as EditorSnapshotInput };
        });
        await synchronizeEditor();
        if (disposed) return;
        setSession(current);
        // A new editor mount must synchronize a save that finished after the old
        // browser request was interrupted before allowing autosave to continue.
        while (!disposed && current.id === sessionId && current.status === "generating") {
          if (current.lease?.locked) {
            // A previous tab/request may still be generating or saving. Poll
            // its progress instead of repeatedly submitting the same lesson.
            await new Promise((resolve) => window.setTimeout(resolve, Math.max(250, Math.min(5_000, current.lease!.retryAfterMs || 2_000))));
            if (disposed) return;
            const next = await sessionRequest<GenerationSessionSnapshot | null>(courseId, undefined, controller.signal);
            if (!next || next.id !== sessionId) throw new Error("Generation session changed. Reload to view the latest progress.");
            if (next.completedLessonIds.join() !== current.completedLessonIds.join() || !next.lease?.locked) await synchronizeEditor();
            if (disposed) return;
            current = next;
            setSession(current);
            if (!current.lease?.locked && current.error && !current.readyToSave) throw new Error(current.error);
            continue;
          }
          if (!current.readyToSave) {
            try {
              current = await sessionRequest(courseId, { action: "prepare", sessionId }, controller.signal);
            } catch (error) {
              if (error instanceof SessionRequestError && error.status === 409 && error.message === "Generation is already running or this course changed. Try again shortly.") {
                // Compatibility with an older server during a rolling update.
                current = { ...current, lease: { locked: true, retryAfterMs: 2_000 } };
                setSession(current);
                continue;
              }
              throw error;
            }
          }
          if (disposed) return;
          setSession(current);
          if (current.status !== "generating") break;
          if (current.lease?.locked) continue;
          if (current.readyToSave) {
            const saving = mutationRef.current((revision) => sessionRequest<SavedSessionResponse>(courseId, { action: "commit", sessionId, revision }, controller.signal));
            activeSaveRef.current = saving;
            let result: SavedSessionResponse;
            try { result = await saving; } finally { activeSaveRef.current = null; }
            current = result.session;
            if (!disposed) setSession(current);
          }
        }
      } catch (error) {
        if (!disposed) {
          setError(error instanceof Error ? error.message : "Generation stopped. Saved lessons are safe.");
          // The status comes from saved lesson receipts, even if the save
          // response was lost. Do not retry provider work automatically.
          void sessionRequest<GenerationSessionSnapshot>(courseId).then((state) => { if (!disposed) setSession(state); }).catch(() => {});
        }
      } finally { if (!disposed) setRunning(false); }
    }
    void run();
    return () => { disposed = true; controller.abort(); };
  }, [courseId, sessionId, retry]);
  async function cancel() {
    if (!session) return;
    try {
      let state = await sessionRequest(courseId, { action: "cancel", sessionId: session.id });
      // A lesson save already in flight may finish during cancellation. Read
      // its final receipt before showing the cancelled progress count.
      if (activeSaveRef.current) {
        await activeSaveRef.current.catch(() => {});
        state = await sessionRequest(courseId);
      }
      setSession(state); setError("");
    }
    catch (error) { setError(error instanceof Error ? error.message : "Could not cancel generation."); }
  }
  function dismissProgress() {
    setProgressVisible(false);
    if (session) {
      try { window.localStorage.setItem(`course-generation-progress-dismissed:${courseId}:${session.id}`, "true"); } catch { /* Closing works even without storage. */ }
    }
  }
  function showProgress() {
    setProgressVisible(true);
    if (session) {
      try { window.localStorage.removeItem(`course-generation-progress-dismissed:${courseId}:${session.id}`); } catch { /* Storage is optional. */ }
    }
  }
  function startSession(value: GenerationSessionSnapshot) {
    setSession(value);
    setProgressVisible(true);
  }
  return { session, running, error, confirmLeave, setSession: startSession, progressVisible, dismissProgress, showProgress, cancel, resume: () => setRetry((value) => value + 1) };
}
