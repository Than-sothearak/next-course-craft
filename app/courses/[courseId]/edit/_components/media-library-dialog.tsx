"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FileDown, ImagePlus, LoaderCircle, Music2, RefreshCw, Search, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { audioUploadContentType } from "@/lib/media/audio-upload";
import { mediaStorageUploadError } from "@/lib/media/messages";
import { filterAndSortMedia, matchesMediaKind, mediaFileTypeLabel, mediaLibrarySortOptions, type MediaLibraryAsset, type MediaLibraryKind, type MediaLibrarySort } from "@/lib/media/library";
import { MediaLibraryAssetCard } from "./media-library-asset-card";

export type { MediaLibraryAsset } from "@/lib/media/library";

async function responseError(response: Response) {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === "string") return body.error;
  } catch {
    // Use a stable message if the server did not return JSON.
  }
  return "The media request failed. Please try again.";
}

type MediaLibraryDialogProps = {
  courseId: string;
  kind: MediaLibraryKind;
  open: boolean;
  onClose: () => void;
  onSelect: (asset: MediaLibraryAsset) => void;
  embedded?: boolean;
};

export function MediaLibraryDialog(props: MediaLibraryDialogProps) {
  return props.open ? <OpenMediaLibrary key={`${props.courseId}:${props.kind}`} {...props} /> : null;
}

function OpenMediaLibrary({ courseId, kind, onClose, onSelect, embedded = false }: MediaLibraryDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [assets, setAssets] = useState<MediaLibraryAsset[] | null>(null);
  const [query, setQuery] = useState("");
  const [fileType, setFileType] = useState("all");
  const [sort, setSort] = useState<MediaLibrarySort>("newest");
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const apiPath = `/api/courses/${courseId}/assets`;
  const kindAssets = (assets ?? []).filter(asset => matchesMediaKind(asset, kind));
  const fileTypes = [...new Set([...kindAssets.map(asset => asset.contentType), ...(fileType === "all" ? [] : [fileType])])].sort();
  const visibleAssets = filterAndSortMedia(assets ?? [], { kind, query, fileType, sort });

  function pausePreviews() {
    libraryRef.current?.querySelectorAll<HTMLMediaElement>("audio, video").forEach(player => { if (!player.paused) player.pause(); });
  }

  function closeLibrary() {
    pausePreviews();
    onClose();
  }

  function chooseAsset(asset: MediaLibraryAsset) {
    pausePreviews();
    onSelect(asset);
    onClose();
  }

  useEffect(() => {
    if (embedded) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    libraryRef.current?.querySelector<HTMLInputElement>('input[type="search"]')?.focus({ preventScroll: true });
    return () => { if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, [embedded]);

  useEffect(() => {
    let cancelled = false;
    async function loadLibrary() {
      let cursor: string | null | undefined;
      const seen = new Set<string>();
      do {
        const response = await fetch(cursor ? `${apiPath}?cursor=${encodeURIComponent(cursor)}` : apiPath, { cache: "no-store" });
        if (!response.ok) throw new Error(await responseError(response));
        const data = await response.json() as { assets: MediaLibraryAsset[]; nextCursor?: string | null };
        if (cancelled) return;
        setAssets(current => [...new Map([...(current ?? []), ...data.assets].map(asset => [asset.id, asset])).values()]);
        cursor = data.nextCursor;
        if (cursor && seen.has(cursor)) throw new Error("Could not load the remaining media. Please reload the library.");
        if (cursor) seen.add(cursor);
      } while (cursor && !cancelled);
    }
    void loadLibrary().catch((requestError: unknown) => {
      if (!cancelled) {
        setAssets(current => current ?? []);
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Could not load the media library.",
        );
      }
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => {
      cancelled = true;
    };
  }, [apiPath, reload]);

  async function uploadFile(file: File) {
    const initResponse = await fetch(apiPath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        contentType: kind === "attachment" ? "application/octet-stream" : kind === "audio" ? audioUploadContentType(file) : file.type,
        ...(kind === "attachment" ? { purpose: "attachment" } : {}),
        size: file.size,
      }),
    });
    if (!initResponse.ok) throw new Error(await responseError(initResponse));
    const upload = (await initResponse.json()) as {
      assetId: string;
      uploadUrl: string;
      fields: Record<string, string>;
      method?: "POST" | "PUT";
      contentType: string;
    };

    const formData = new FormData();
    for (const [name, value] of Object.entries(upload.fields))
      formData.append(name, value);
    formData.append("file", file);
    let storageResponse: Response;
    try {
      storageResponse = await fetch(upload.uploadUrl, {
        method: upload.method ?? "POST",
        headers: upload.method === "PUT" ? { "Content-Type": upload.contentType } : undefined,
        body: upload.method === "PUT" ? file : formData,
      });
    } catch {
      throw new Error(upload.method === "PUT" ? "The upload could not reach local storage. Please try again." : mediaStorageUploadError(window.location.origin));
    }
    if (!storageResponse.ok)
      throw new Error(
        upload.method === "PUT" ? await responseError(storageResponse) : mediaStorageUploadError(
          window.location.origin,
          storageResponse.status,
        ),
      );

    const completeResponse = await fetch(
      `${apiPath}/${upload.assetId}/complete`,
      { method: "POST" },
    );
    if (!completeResponse.ok)
      throw new Error(await responseError(completeResponse));
    const asset = (await completeResponse.json()) as MediaLibraryAsset;
    setAssets((current) => [
      asset,
      ...(current ?? []).filter((existing) => existing.id !== asset.id),
    ]);
    return asset;
  }

  async function uploadFiles(files: File[]) {
    if (files.length === 0) return;
    setUploading(true);
    setUploadProgress({ current: 1, total: files.length });
    setError(null);
    const failures: string[] = [];

    try {
      for (const [index, file] of files.entries()) {
        setUploadProgress({ current: index + 1, total: files.length });
        try {
          await uploadFile(file);
        } catch (uploadError: unknown) {
          const message = uploadError instanceof Error
            ? uploadError.message
            : "The file could not be uploaded.";
          failures.push(`${file.name}: ${message}`);
        }
      }
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }

    if (failures.length > 0) {
      const failureSummary = failures.slice(0, 3).join(" ");
      const remainingCount = failures.length - 3;
      setError(`${failures.length} of ${files.length} files could not be uploaded. ${failureSummary}${remainingCount > 0 ? ` And ${remainingCount} more.` : ""}`);
    }
  }

  async function deleteAsset(asset: MediaLibraryAsset) {
    if (
      !window.confirm(
        `Delete “${asset.originalName}” from this media library and storage? Course content using this file will no longer display it.`,
      )
    )
      return;
    setDeletingAssetId(asset.id);
    setError(null);
    try {
      const response = await fetch(`${apiPath}/${asset.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(await responseError(response));
      setAssets((current) =>
        (current ?? []).filter((existing) => existing.id !== asset.id),
      );
    } catch (deleteError: unknown) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "The media file could not be deleted.",
      );
    } finally {
      setDeletingAssetId(null);
    }
  }

  const kindLabel = kind === "audio" ? "audio file" : kind;

  return (
    <div
      ref={libraryRef}
      data-media-library
      className={embedded ? "flex min-h-0 flex-1 flex-col" : "dialog-backdrop-in fixed inset-0 z-[10020] flex items-center justify-center bg-slate-950/45 p-3 sm:p-6"}
      onClick={(event) => {
        if (!embedded && event.target === event.currentTarget) { event.stopPropagation(); closeLibrary(); }
      }}
      onPlayCapture={(event) => {
        if (!(event.target instanceof HTMLMediaElement)) return;
        const active = event.target;
        event.currentTarget.querySelectorAll<HTMLMediaElement>("audio, video").forEach(player => { if (player !== active && !player.paused) player.pause(); });
      }}
      onKeyDown={(event) => {
        if (embedded) return;
        if (event.key === "Escape" && !document.fullscreenElement) { event.preventDefault(); event.stopPropagation(); closeLibrary(); }
        if (event.key !== "Tab") return;
        const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), input[type="search"], select:not([disabled]), audio[controls], video[controls]')].filter(control => control.getClientRects().length > 0);
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}
    >
      <section
        role={embedded ? undefined : "dialog"}
        aria-modal={embedded ? undefined : true}
        aria-label={embedded ? "Media library" : undefined}
        aria-labelledby={embedded ? undefined : titleId}
        className={embedded ? "@container/media-library flex min-h-0 flex-1 flex-col overflow-hidden bg-white" : "@container/media-library dialog-panel-in flex h-[min(800px,calc(100dvh-24px))] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:h-[min(800px,calc(100dvh-48px))]"}
      >
        {!embedded && <header className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <h2
              id={titleId}
              className="text-base font-semibold text-slate-900"
            >
              Media library
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {kind === "attachment" ? "Choose a file or upload any file type (up to 250 MB). Learners can download it from the lesson." : kind === "audio" ? "Choose an audio file or upload MP3, M4A, OGG, WAV, or WebM (up to 100 MB)." : `Choose a ${kindLabel} or upload a new file.`}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Close media library"
            onClick={closeLibrary}
          >
            <X size={18} />
          </Button>
        </header>}
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain p-4 sm:p-5">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={
              kind === "image"
                ? "image/avif,image/gif,image/jpeg,image/png,image/webp"
                : kind === "video" ? "video/mp4,video/webm"
                : kind === "audio" ? "audio/mpeg,audio/mp4,audio/ogg,audio/wav,audio/webm,.mp3,.m4a,.ogg,.oga,.wav,.webm,.weba"
                : kind === "attachment" ? "*/*"
                : "application/pdf,text/plain"
            }
            className="hidden"
            aria-label={`Upload ${kindLabel}`}
            onChange={(event) => {
              const files = Array.from(event.currentTarget.files ?? []);
              event.currentTarget.value = "";
              void uploadFiles(files);
            }}
          />
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
            <p aria-live="polite" className="text-sm font-medium text-slate-700">
              {visibleAssets.length} of {kindAssets.length} files
              {loading && assets !== null && <span className="ml-2 text-xs font-normal text-slate-500">Loading more…</span>}
            </p>
            <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="icon" aria-label="Reload media" title="Reload media" disabled={loading || uploading || deletingAssetId !== null} onClick={() => { setAssets(null); setLoading(true); setError(null); setReload(current => current + 1); }} className="size-8"><RefreshCw size={14} /></Button>
            <Button
              type="button"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || uploading || deletingAssetId !== null}
              aria-busy={uploading}
            >
              {uploading ? (
                <LoaderCircle size={15} className="animate-spin" />
              ) : kind === "attachment" ? (
                <FileDown size={15} />
              ) : kind === "audio" ? (
                <Music2 size={15} />
              ) : kind === "image" ? (
                <ImagePlus size={15} />
              ) : (
                <Video size={15} />
              )}
              {uploading
                ? `Uploading ${uploadProgress?.current ?? 1} of ${uploadProgress?.total ?? 1}…`
                : kind === "attachment"
                  ? "Upload files"
                  : kind === "audio"
                    ? "Upload audio files"
                    : "Upload media files"}
            </Button>
            </div>
          </div>
          <div className="grid shrink-0 grid-cols-1 gap-2 @min-[38rem]/media-library:grid-cols-[minmax(0,1fr)_minmax(0,180px)_minmax(0,180px)]">
            <label className="min-w-0 space-y-1 text-xs font-medium text-slate-600">Search media
              <span className="relative mt-1 block"><Search size={15} aria-hidden="true" className="pointer-events-none absolute left-3 top-3 text-slate-400" /><Input type="search" aria-label="Search media" placeholder="Search filename or file type" value={query} onChange={event => setQuery(event.target.value)} className="pl-9" /></span>
            </label>
            <label className="min-w-0 space-y-1 text-xs font-medium text-slate-600">File type
              <Select aria-label="Filter media by file type" value={fileType} onChange={event => setFileType(event.target.value)}><option value="all">All file types</option>{fileTypes.map(type => <option key={type} value={type}>{mediaFileTypeLabel(type)}</option>)}</Select>
            </label>
            <label className="min-w-0 space-y-1 text-xs font-medium text-slate-600">Sort by
              <Select aria-label="Sort media" value={sort} onChange={event => setSort(event.target.value as MediaLibrarySort)}>{mediaLibrarySortOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</Select>
            </label>
          </div>
          {error && (
            <p
              role="alert"
              className="shrink-0 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700"
            >
              {error}
            </p>
          )}
          <div className="shrink-0">
          {assets === null ? (
            <div className="grid flex-1 place-items-center py-16 text-sm text-slate-500">
              <span className="flex items-center gap-2">
                <LoaderCircle size={16} className="animate-spin" />
                Loading media…
              </span>
            </div>
          ) : visibleAssets.length ? (
            <div className="grid grid-cols-1 gap-3 @min-[30rem]/media-library:grid-cols-2 @min-[48rem]/media-library:grid-cols-3">
              {visibleAssets.map(asset => <MediaLibraryAssetCard key={asset.id} asset={asset} onSelect={() => chooseAsset(asset)} onDelete={() => void deleteAsset(asset)} busy={loading || uploading || deletingAssetId !== null} deleting={deletingAssetId === asset.id} />)}
            </div>
          ) : (
            <div className="grid flex-1 place-items-center py-12 text-center">
              <div>
                <div className="mx-auto grid size-12 place-items-center rounded-full bg-slate-100 text-slate-500">
                  {kind === "image" ? (
                    <ImagePlus size={21} />
                  ) : kind === "audio" ? (
                    <Music2 size={21} />
                  ) : kind === "attachment" ? (
                    <FileDown size={21} />
                  ) : (
                    <Video size={21} />
                  )}
                </div>
                <p className="mt-3 text-sm font-medium text-slate-700">
                  {kindAssets.length ? "No matching media" : `No ${kindLabel}s yet`}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {kindAssets.length ? "Try another search or file type." : "Upload a file to add it to this course’s media library."}
                </p>
                {kindAssets.length > 0 && <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => { setQuery(""); setFileType("all"); }}>Clear filters</Button>}
              </div>
            </div>
          )}
          </div>
        </div>
        {!embedded && <footer className="flex shrink-0 justify-end border-t border-slate-100 px-5 py-3 sm:px-6">
          <Button type="button" variant="ghost" onClick={closeLibrary}>
            Close
          </Button>
        </footer>}
      </section>
    </div>
  );
}
