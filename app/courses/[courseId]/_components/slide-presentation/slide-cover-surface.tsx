import Image from "next/image";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SlideCover } from "@/lib/editor/slide-design";

export function SlideCoverSurface({ cover, title, menuControl, onStart, startDisabled = false, startHint }: {
  cover: SlideCover;
  title: string;
  menuControl?: ReactNode;
  onStart?: () => void;
  startDisabled?: boolean;
  startHint?: string;
}) {
  return <div className="relative h-full w-full overflow-hidden bg-slate-900 text-white">
    {cover.imageSrc ? <Image src={cover.imageSrc} alt={cover.imageAlt} fill unoptimized className="object-cover" sizes="960px" /> : <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-indigo-700 to-sky-600" />}
    <div className="absolute inset-0" style={{ backgroundColor: `rgba(4, 10, 32, ${cover.overlayOpacity / 100})` }} />
    <div className="absolute inset-x-16 top-1/2 z-10 -translate-y-1/2 text-center">
      {cover.lessonOf && <p className="mb-4 text-sm font-semibold uppercase tracking-[0.24em] text-white/90">{cover.lessonOf}</p>}
      <h1 className="text-6xl font-bold leading-tight tracking-tight drop-shadow-lg">{title}</h1>
      {cover.subtitle && <p className="mx-auto mt-5 max-w-2xl text-xl leading-relaxed text-white/95">{cover.subtitle}</p>}
      <Button type="button" size="lg" disabled={!onStart || startDisabled} title={startHint} onClick={onStart} className="mt-9 min-w-36 bg-white text-indigo-950 hover:bg-white/90">{cover.startLabel}<ArrowRight size={17} /></Button>
    </div>
    {menuControl}
  </div>;
}
