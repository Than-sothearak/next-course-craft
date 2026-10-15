import type { ImageLayout } from "@/lib/schemas/block";
import { MiniLandscape } from "./mini-landscape";

export function ImageTemplatePreview({ layout }: { layout: ImageLayout }) {
  if (layout === "text-left" || layout === "text-right") {
    const text = <div className="space-y-2"><span className="block h-2 w-3/4 rounded bg-slate-800" /><span className="block h-1.5 w-full rounded bg-slate-300" /><span className="block h-1.5 w-5/6 rounded bg-slate-300" /><span className="block h-1.5 w-2/3 rounded bg-slate-300" /></div>;
    const image = <MiniLandscape className="aspect-[4/3] rounded-md" />;
    return <div className="grid grid-cols-2 items-center gap-2">{layout === "text-left" ? <>{text}{image}</> : <>{image}{text}</>}</div>;
  }
  if (layout === "text-overlay")
    return <div className="relative"><MiniLandscape className="aspect-video rounded-lg" /><div className="absolute inset-0 flex flex-col justify-end rounded-lg bg-gradient-to-t from-slate-950/80 via-slate-900/10 to-transparent p-3"><span className="text-[11px] font-semibold text-white">A visual introduction</span><span className="mt-1 text-[8px] text-white/80">Set the scene for this lesson.</span></div></div>;
  if (layout === "card")
    return <div className="overflow-hidden rounded-lg border border-slate-200 bg-white"><MiniLandscape className="aspect-video" /><div className="space-y-1.5 p-2"><span className="block h-2 w-2/3 rounded bg-slate-800" /><span className="block h-1.5 w-full rounded bg-slate-300" /><span className="block h-1.5 w-4/5 rounded bg-slate-300" /></div></div>;
  return <MiniLandscape className={layout === "banner" ? "aspect-[21/9] min-h-24 rounded-lg" : "h-24 rounded-md"} />;
}

