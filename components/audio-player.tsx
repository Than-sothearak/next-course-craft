import { Music2 } from "lucide-react";

export function AudioPlayer({ src, fileName, onEnded }: { src: string; fileName: string; onEnded?: () => void }) {
  if (!src) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
        <Music2 size={22} className="shrink-0" />
        <span>Choose or upload an audio file in content settings.</span>
      </div>
    );
  }
  return (
    <figure className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <figcaption className="flex min-w-0 items-center gap-2 text-sm font-medium text-slate-800">
        <Music2 size={18} className="shrink-0 text-indigo-600" />
        <span className="break-all">{fileName || "Lesson audio"}</span>
      </figcaption>
      <audio key={src} onEnded={onEnded} controls preload="metadata" src={src} aria-label={fileName || "Lesson audio"} className="w-full">
        Your browser does not support audio playback.
      </audio>
    </figure>
  );
}
