/* eslint-disable @next/next/no-img-element -- Shared presentation artwork must also run in standalone exports. */
import { resolveSlideHeader, type SlideMaster } from "@/lib/editor/slide-design";
import { backgroundPaint } from "@/lib/color";
import { SlideColorOverlay } from "./slide-color-overlay";

export function SlideHeaderBackground({ master, height = 108 }: { master: SlideMaster; height?: number | string }) {
  const header = resolveSlideHeader(master);
  return <div aria-hidden="true" data-slide-header-background={header.background} className="pointer-events-none absolute inset-x-0 top-0 overflow-hidden" style={{ height, ...(header.background === "transparent" ? {} : backgroundPaint(header.backgroundColor)) }}>
    {header.background === "image" && header.imageSrc && <>
      <img src={header.imageSrc} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: header.imagePosition }} />
      <SlideColorOverlay color={header.overlayColor ?? header.backgroundColor} opacity={header.overlayOpacity} />
    </>}
    {header.borderTop && <span data-slide-header-border="top" className="absolute inset-x-0 top-0" style={{ height: header.borderWidth, ...backgroundPaint(header.borderColor) }} />}
    {header.borderBottom && <span data-slide-header-border="bottom" className="absolute inset-x-0 bottom-0" style={{ height: header.borderWidth, ...backgroundPaint(header.borderColor) }} />}
  </div>;
}
