/* eslint-disable @next/next/no-img-element -- Shared presentation artwork must also run in standalone exports. */
import { resolveSlideHeader, type SlideMaster } from "@/lib/editor/slide-design";
import { backgroundPaint } from "@/lib/color";

export function SlideHeaderBackground({ master }: { master: SlideMaster }) {
  const header = resolveSlideHeader(master);
  return <div aria-hidden="true" data-slide-header-background={header.background} className="pointer-events-none absolute inset-x-0 top-0 h-[108px] overflow-hidden" style={header.background === "transparent" ? undefined : backgroundPaint(header.backgroundColor)}>
    {header.background === "image" && header.imageSrc && <>
      <img src={header.imageSrc} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: header.imagePosition }} />
      <div className="absolute inset-0" style={{ ...backgroundPaint(header.backgroundColor), opacity: header.overlayOpacity / 100 }} />
    </>}
  </div>;
}
