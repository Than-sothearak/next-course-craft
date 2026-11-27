"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, ExternalLink, Link2, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { markDashboardRefreshPending } from "@/lib/editor/dashboard-refresh";

type Share = { path: string; publishedAt: string };

export function CourseShareDialog({ courseId, onClose, onPublished, onShareChanged }: {
  courseId: string;
  onClose: () => void;
  onPublished?: () => void;
  onShareChanged?: () => void;
}) {
  const [share, setShare] = useState<Share | null>(null);
  const [busy, setBusy] = useState<"loading" | "publishing" | "revoking" | null>("loading");
  const [loaded, setLoaded] = useState(false);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const changedRef = useRef(false);
  const endpoint = `/api/courses/${courseId}/publish/share`;
  const url = share ? new URL(share.path, window.location.origin).href : "";

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setBusy("loading");
      setError(null);
      try {
        const response = await fetch(endpoint, { cache: "no-store", signal: controller.signal });
        const result = await response.json() as { share?: Share | null; error?: string };
        if (!response.ok) throw new Error(result.error || "Could not load the share link.");
        setShare(result.share ?? null);
        setLoaded(true);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load the share link.");
      } finally {
        if (!controller.signal.aborted) setBusy(null);
      }
    }
    void load();
    return () => controller.abort();
  }, [endpoint, reload]);

  async function update(method: "POST" | "DELETE") {
    setBusy(method === "POST" ? "publishing" : "revoking");
    setError(null);
    setCopied(false);
    setNotice(null);
    try {
      const response = await fetch(endpoint, { method });
      const result = await response.json() as { share?: Share | null; error?: string };
      if (!response.ok) throw new Error(result.error || "Could not update the share link.");
      setShare(result.share ?? null);
      changedRef.current = true;
      markDashboardRefreshPending();
      setNotice(method === "POST" ? "Published. Your share link is ready." : "Public access is off. The previous link no longer works.");
      if (method === "POST") onPublished?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update the share link.");
    } finally { setBusy(null); }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setError(null);
    } catch { setError("Select the share link and copy it manually."); }
  }

  return (
    <Dialog open title="Share course" onClose={() => { onClose(); if (changedRef.current) onShareChanged?.(); }} busy={busy !== null} className="max-w-lg">
      <p className="text-sm leading-6 text-slate-600">Publish a public link so anyone can take this course without signing in. Publishing uses your latest saved course. Draft edits stay private until you publish an update.</p>
      {busy === "loading" && <p role="status" className="mt-5 flex items-center gap-2 text-sm text-slate-500"><LoaderCircle size={16} className="animate-spin" />Loading share link…</p>}
      {loaded && (share ? (
        <div className="mt-5 space-y-3">
          <label htmlFor={`course-share-${courseId}`} className="block text-sm font-medium">Public share link</label>
          <div className="flex gap-2">
            <Input id={`course-share-${courseId}`} value={url} readOnly onFocus={(event) => event.target.select()} />
            <Button type="button" variant="outline" onClick={() => void copyLink()} disabled={busy !== null} aria-label="Copy share link">{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? "Copied" : "Copy"}</Button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>Published {new Date(share.publishedAt).toLocaleString()}</span>
            <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-indigo-700 underline underline-offset-4">Open course<ExternalLink size={12} /></a>
          </div>
        </div>
      ) : <p className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">Public access is off. Publish to create your share link.</p>)}
      {notice && <p role="status" className="mt-4 text-sm text-emerald-700">{notice}</p>}
      {error && <p role="alert" className="mt-4 text-sm text-rose-700">{error}{!loaded && <Button type="button" variant="ghost" size="sm" disabled={busy !== null} onClick={() => setReload((value) => value + 1)}>Retry</Button>}</p>}
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        {share && <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void update("DELETE")}>{busy === "revoking" ? "Turning off…" : "Turn off link"}</Button>}
        <Button type="button" disabled={!loaded || busy !== null} onClick={() => void update("POST")}>
          {busy === "publishing" ? <LoaderCircle size={16} className="animate-spin" /> : <Link2 size={16} />}
          {busy === "publishing" ? "Publishing…" : share ? "Publish update" : "Publish share link"}
        </Button>
      </div>
    </Dialog>
  );
}
