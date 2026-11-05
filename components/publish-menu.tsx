"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Download, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { courseExportFilename, type CourseExportFormat } from "@/lib/export/filename";

type PublishFormat = CourseExportFormat;

const formats: Array<{ id: PublishFormat; label: string; endpoint: string }> = [
  { id: "html", label: "HTML", endpoint: "" },
  { id: "pdf", label: "PDF handout", endpoint: "/pdf" },
  { id: "scorm12", label: "SCORM 1.2", endpoint: "/scorm12" },
  { id: "scorm2004", label: "SCORM 2004", endpoint: "/scorm2004" },
];

export async function receiveExport(response: Response, onProgress: (stage: string, value: number) => void) {
  if (!response.body) throw new Error("The export response was empty.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const fileParts: BlobPart[] = [];
  let receivedBytes = 0;
  let pending = new Uint8Array();
  let fileSize = 0;
  let filename = "";
  let readingFile = false;
  const append = (left: Uint8Array, right: Uint8Array) => {
    const joined = new Uint8Array(left.length + right.length);
    joined.set(left); joined.set(right, left.length); return joined;
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (readingFile) {
        fileParts.push(value.slice().buffer as ArrayBuffer);
        receivedBytes += value.length;
        onProgress("Downloading export", Math.min(99, 94 + Math.floor(5 * receivedBytes / Math.max(fileSize, 1))));
        continue;
      }
      pending = append(pending, value);
      let newline = pending.indexOf(10);
      while (newline >= 0 && !readingFile) {
        const line = decoder.decode(pending.subarray(0, newline));
        pending = pending.subarray(newline + 1);
        const message = JSON.parse(line) as { type: string; stage?: string; value?: number; size?: number; filename?: string; message?: string };
        if (message.type === "progress") onProgress(message.stage ?? "Preparing export", message.value ?? 0);
        else if (message.type === "error") throw new Error(message.message || "Could not create the export.");
        else if (message.type === "file") {
          readingFile = true;
          fileSize = message.size ?? 0;
          filename = message.filename ?? filename;
          onProgress("Downloading export", 94);
          if (pending.length) {
            fileParts.push(pending.slice().buffer as ArrayBuffer);
            receivedBytes += pending.length;
            onProgress("Downloading export", Math.min(99, 94 + Math.floor(5 * receivedBytes / Math.max(fileSize, 1))));
            pending = new Uint8Array();
          }
        }
        newline = pending.indexOf(10);
      }
    }
  } finally { reader.releaseLock(); }
  if (!readingFile) throw new Error("The export ended before the file was ready.");
  if (receivedBytes !== fileSize) throw new Error("The export download was incomplete.");
  onProgress("Download ready", 100);
  return { blob: new Blob(fileParts), filename };
}

export function PublishMenu({
  courseId,
  title,
  disabled = false,
  disabledReason,
  className,
  openUpward = false,
  compact = false,
  onPublished,
}: {
  courseId: string;
  title: string;
  disabled?: boolean;
  disabledReason?: string;
  className?: string;
  openUpward?: boolean;
  compact?: boolean;
  onPublished?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [publishing, setPublishing] = useState<PublishFormat | null>(null);
  const [progress, setProgress] = useState<{ stage: string; value: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failedFormat, setFailedFormat] = useState<PublishFormat | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  async function publish(format: PublishFormat) {
    const selected = formats.find((item) => item.id === format)!;
    const controller = new AbortController();
    abortRef.current = controller;
    setPublishing(format);
    setProgress({ stage: "Starting export", value: 0 });
    setError(null);
    setFailedFormat(null);
    setOpen(false);
    try {
      const response = await fetch(`/api/courses/${courseId}/publish${selected.endpoint}`, { method: "POST", signal: controller.signal });
      if (!response.ok) {
        const result = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(result?.error || `Could not create the ${selected.label} course.`);
      }
      const { blob, filename } = await receiveExport(response, (stage, value) => setProgress({ stage, value }));
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename || courseExportFilename(title, format);
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setProgress({ stage: "Download started", value: 100 });
      window.setTimeout(() => setProgress((current) => current?.value === 100 ? null : current), 4000);
      onPublished?.();
    } catch (cause) {
      if (controller.signal.aborted) setProgress(null);
      else {
        setError(cause instanceof Error ? cause.message : `Could not create the ${selected.label} course.`);
        setFailedFormat(format);
      }
    } finally {
      abortRef.current = null;
      setPublishing(null);
    }
  }

  return (
    <div ref={menuRef} className="relative">
      <Button
        type="button"
        variant={compact ? "ghost" : "outline"}
        size={compact ? "icon" : "sm"}
        disabled={disabled || publishing !== null}
        title={disabled ? disabledReason : "Publish course"}
        aria-label="Publish course"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => { setError(null); setProgress(null); setOpen((current) => !current); }}
        className={compact ? `size-8 min-h-0 rounded-md border-0 bg-transparent p-0 text-slate-600 shadow-none hover:bg-slate-100 hover:text-slate-900 ${className ?? ""}` : className}
      >
        {publishing ? <LoaderCircle size={14} className="animate-spin" /> : <Download size={14} />}
        {!compact && (publishing ? "Exporting…" : "Publish")}
        {!compact && !publishing && <ChevronDown size={14} />}
      </Button>
      {open && (
        <div role="menu" aria-label="Publish format" className={`absolute right-0 z-[70] w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl ${openUpward ? "bottom-full mb-2" : "top-full mt-2"}`}>
          {formats.map((format) => (
            <Button
              key={format.id}
              type="button"
              variant="ghost"
              size="sm"
              role="menuitem"
              disabled={publishing !== null}
              onClick={() => void publish(format.id)}
              className="h-10 w-full justify-start rounded-lg px-3 text-left text-sm font-medium text-slate-700"
            >
              {format.label}
            </Button>
          ))}
          {error && <p role="alert" className="mx-2 my-1 border-t border-slate-100 pt-2 text-xs leading-5 text-rose-700">{error}</p>}
        </div>
      )}
      {progress && (publishing || progress.value === 100) && (
        <section role="status" aria-live="polite" aria-label={`${formats.find((item) => item.id === publishing)?.label} export progress`} className={`absolute right-0 z-[71] w-72 rounded-xl border border-slate-200 bg-white p-4 shadow-xl ${openUpward ? "bottom-full mb-2" : "top-full mt-2"}`}>
          <div className="mb-2 flex items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-900">{progress.value === 100 ? "Export ready" : `Exporting ${formats.find((item) => item.id === publishing)?.label}`}</p><span className="text-sm tabular-nums text-slate-600">{progress.value}%</span></div>
          <Progress value={progress.value} aria-label="Export progress" />
          <p className="mt-2 truncate text-xs text-slate-600">{progress.stage}</p>
          {publishing && <div className="mt-3 flex justify-end"><Button type="button" variant="outline" size="sm" onClick={() => abortRef.current?.abort()}>Cancel</Button></div>}
        </section>
      )}
      {error && !open && <div role="alert" className="absolute right-0 top-full z-[71] mt-2 w-72 rounded-xl border border-rose-200 bg-white p-3 text-xs text-rose-700 shadow-xl">{error}{failedFormat && <Button variant="ghost" size="sm" className="ml-2 h-7" onClick={() => void publish(failedFormat)}>Retry</Button>}</div>}
    </div>
  );
}
