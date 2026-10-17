"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ImagePlus, LoaderCircle, Music, Trash2, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mediaStorageUploadError } from "@/lib/media/messages";

export type MediaLibraryAsset = {
  id: string;
  originalName: string;
  contentType: string;
  size: number;
  fileUrl: string;
  createdAt: string;
};

type MediaKind = "image" | "video" | "audio";

function formatMediaSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

async function responseError(response: Response) {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === "string") return body.error;
  } catch {
    // Use a stable message if the server did not return JSON.
  }
  return "The media request failed. Please try again.";
}

export function MediaLibraryDialog({
  courseId,
  kind,
  open,
  onClose,
  onSelect,
}: {
  courseId: string;
  kind: MediaKind;
  open: boolean;
  onClose: () => void;
  onSelect: (asset: MediaLibraryAsset) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<MediaLibraryAsset[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const apiPath = `/api/courses/${courseId}/assets`;
  const visibleAssets = (assets ?? []).filter((asset) =>
    asset.contentType.startsWith(`${kind}/`),
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void fetch(apiPath, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(await responseError(response));
        return response.json() as Promise<{ assets: MediaLibraryAsset[] }>;
      })
      .then((data) => {
        if (!cancelled) {
          setAssets(data.assets);
          setError(null);
        }
      })
      .catch((requestError: unknown) => {
        if (!cancelled) {
          setAssets([]);
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Could not load the media library.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [apiPath, open]);

  async function uploadFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const initResponse = await fetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
          size: file.size,
        }),
      });
      if (!initResponse.ok) throw new Error(await responseError(initResponse));
      const upload = (await initResponse.json()) as {
        assetId: string;
        uploadUrl: string;
        fields: Record<string, string>;
      };

      const formData = new FormData();
      for (const [name, value] of Object.entries(upload.fields))
        formData.append(name, value);
      formData.append("file", file);
      let storageResponse: Response;
      try {
        storageResponse = await fetch(upload.uploadUrl, {
          method: "POST",
          body: formData,
        });
      } catch {
        throw new Error(mediaStorageUploadError(window.location.origin));
      }
      if (!storageResponse.ok)
        throw new Error(
          mediaStorageUploadError(
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
    } catch (uploadError: unknown) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "The file could not be uploaded.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function deleteAsset(asset: MediaLibraryAsset) {
    if (
      !window.confirm(
        `Delete “${asset.originalName}” from this media library and S3? Course content using this file will no longer display it.`,
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

  if (!open) return null;
  const kindLabel = kind;

  return (
    <div
      className="dialog-backdrop-in fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-3 sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="media-library-title"
        className="dialog-panel-in flex max-h-[min(760px,calc(100dvh-24px))] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:max-h-[min(760px,calc(100dvh-48px))]"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <h2
              id="media-library-title"
              className="text-base font-semibold text-slate-900"
            >
              Media library
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Choose {kindLabel} or upload a new file.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Close media library"
            onClick={onClose}
          >
            <X size={18} />
          </Button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5 sm:p-6">
          <input
            ref={fileInputRef}
            type="file"
            accept={
              kind === "image"
                ? "image/avif,image/gif,image/jpeg,image/png,image/webp"
                : kind === "audio" ? "audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/x-wav,audio/ogg,audio/webm" : "video/mp4,video/webm"
            }
            className="sr-only"
            aria-label={`Upload ${kindLabel}`}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file) void uploadFile(file);
            }}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-700">
              {visibleAssets.length} {kindLabel}
              {visibleAssets.length === 1 ? "" : "s"}
            </p>
            <Button
              type="button"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || deletingAssetId !== null}
            >
              {uploading ? (
                <LoaderCircle size={15} className="animate-spin" />
              ) : kind === "image" ? (
                <ImagePlus size={15} />
              ) : kind === "audio" ? (
                <Music size={15} />
              ) : (
                <Video size={15} />
              )}
              {uploading ? "Uploading…" : "Upload media"}
            </Button>
          </div>
          {error && (
            <p
              role="alert"
              className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700"
            >
              {error}
            </p>
          )}
          {assets === null ? (
            <div className="grid flex-1 place-items-center py-16 text-sm text-slate-500">
              <span className="flex items-center gap-2">
                <LoaderCircle size={16} className="animate-spin" />
                Loading media…
              </span>
            </div>
          ) : visibleAssets.length ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="group relative overflow-hidden rounded-xl border border-slate-200 transition-colors hover:border-indigo-400 hover:bg-indigo-50/30"
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(asset);
                      onClose();
                    }}
                    aria-label={`Use ${asset.originalName}`}
                    className="block w-full text-left focus-visible:outline-2 focus-visible:outline-indigo-500"
                  >
                    <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
                      {asset.contentType.startsWith("image/") ? (
                        <Image
                          src={asset.fileUrl}
                          alt=""
                          fill
                          unoptimized
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                        />
                      ) : (
                        <div className="grid h-full place-items-center bg-slate-900 text-white">
                          {kind === "audio" ? <Music size={30} /> : <Video size={30} />}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 p-3 pr-12">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {asset.originalName}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatMediaSize(asset.size)}
                      </p>
                    </div>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${asset.originalName}`}
                    title="Delete media"
                    disabled={uploading || deletingAssetId !== null}
                    onClick={() => void deleteAsset(asset)}
                    className="absolute right-2 top-2 size-8 bg-white/95 text-slate-600 shadow-sm hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
                  >
                    {deletingAssetId === asset.id ? (
                      <LoaderCircle size={15} className="animate-spin" />
                    ) : (
                      <Trash2 size={15} />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid flex-1 place-items-center py-12 text-center">
              <div>
                <div className="mx-auto grid size-12 place-items-center rounded-full bg-slate-100 text-slate-500">
                  {kind === "image" ? (
                    <ImagePlus size={21} />
                  ) : (
                    <Video size={21} />
                  )}
                </div>
                <p className="mt-3 text-sm font-medium text-slate-700">
                  No {kindLabel}s yet
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Upload a file to add it to this course’s media library.
                </p>
              </div>
            </div>
          )}
        </div>
        <footer className="flex shrink-0 justify-end border-t border-slate-100 px-5 py-3 sm:px-6">
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </footer>
      </section>
    </div>
  );
}
