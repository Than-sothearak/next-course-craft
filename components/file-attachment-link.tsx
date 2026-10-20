import { Download, FileDown, Paperclip } from "lucide-react";

function formatFileSize(size: number) {
  if (size < 1024) return `${size} bytes`;
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileAttachmentLink({
  href,
  fileName,
  size,
}: {
  href: string;
  fileName: string;
  size: number;
}) {
  if (!href) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
        <Paperclip size={18} aria-hidden="true" />
        <span>Choose a file to add a downloadable attachment.</span>
      </div>
    );
  }

  return (
    <a
      href={href}
      download={fileName || undefined}
      className="group flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-indigo-300 hover:bg-indigo-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-700">
        <FileDown size={21} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-slate-900">{fileName || "Download attachment"}</span>
        <span className="mt-1 block text-xs text-slate-500">{formatFileSize(size)} · Download file</span>
      </span>
      <Download size={18} aria-hidden="true" className="shrink-0 text-slate-400 group-hover:text-indigo-700" />
    </a>
  );
}
