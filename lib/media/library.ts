export type MediaLibraryAsset = {
  id: string;
  originalName: string;
  contentType: string;
  size: number;
  fileUrl: string;
  createdAt: string;
};

export type MediaLibraryKind = "image" | "video" | "audio" | "document" | "attachment";

export const mediaLibrarySortOptions = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name-asc", label: "Name (A–Z)" },
  { value: "name-desc", label: "Name (Z–A)" },
  { value: "type", label: "File type" },
  { value: "size-desc", label: "Largest first" },
  { value: "size-asc", label: "Smallest first" },
] as const;
export type MediaLibrarySort = (typeof mediaLibrarySortOptions)[number]["value"];

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

export function matchesMediaKind(asset: MediaLibraryAsset, kind: MediaLibraryKind) {
  if (kind === "attachment") return true;
  if (kind === "document") return ["application/pdf", "text/plain"].includes(asset.contentType);
  return asset.contentType.startsWith(`${kind}/`);
}

export function mediaFileTypeLabel(contentType: string) {
  const labels: Record<string, string> = {
    "audio/mpeg": "MP3 audio", "audio/mp4": "M4A audio", "audio/wav": "WAV audio",
    "audio/ogg": "OGG audio", "audio/webm": "WebM audio", "video/mp4": "MP4 video",
    "video/webm": "WebM video", "application/pdf": "PDF document", "text/plain": "Text document",
    "application/octet-stream": "Other file", "image/jpeg": "JPEG image",
  };
  return labels[contentType] ?? `${contentType.split("/")[1]?.toUpperCase() ?? contentType} ${contentType.split("/")[0]}`;
}

export function filterAndSortMedia(assets: readonly MediaLibraryAsset[], {
  kind, query = "", fileType = "all", sort = "newest",
}: { kind: MediaLibraryKind; query?: string; fileType?: string; sort?: MediaLibrarySort }) {
  const terms = query.normalize("NFKC").toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return assets.filter(asset => {
    if (!matchesMediaKind(asset, kind) || (fileType !== "all" && asset.contentType !== fileType)) return false;
    const text = `${asset.originalName} ${asset.contentType} ${mediaFileTypeLabel(asset.contentType)}`.normalize("NFKC").toLocaleLowerCase();
    return terms.every(term => text.includes(term));
  }).sort((a, b) => {
    const byName = collator.compare(a.originalName, b.originalName);
    const byDate = (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0);
    const comparison = sort === "newest" ? -byDate : sort === "oldest" ? byDate
      : sort === "name-asc" ? byName : sort === "name-desc" ? -byName
      : sort === "type" ? collator.compare(a.contentType, b.contentType)
      : sort === "size-desc" ? b.size - a.size : a.size - b.size;
    return comparison || byName || a.id.localeCompare(b.id);
  });
}
