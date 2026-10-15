import { ImageIcon } from "lucide-react";

export function MiniLandscape({ className = "" }: { className?: string }) {
  return <div className={`relative overflow-hidden bg-gradient-to-br from-sky-200 via-cyan-100 to-emerald-200 ${className}`}>
    <div className="absolute bottom-0 h-1/2 w-full bg-gradient-to-t from-emerald-700/40 to-transparent" />
    <div className="absolute left-7 top-5 size-8 rounded-full bg-amber-200" />
    <div className="absolute bottom-0 h-1/2 w-full [clip-path:polygon(0_100%,34%_20%,56%_70%,76%_10%,100%_100%)] bg-emerald-600/70" />
    <ImageIcon size={18} className="absolute right-2 top-2 z-10 text-white drop-shadow" />
  </div>;
}

