import { backgroundPaint } from "@/lib/color";
import type { SlideBackground } from "@/lib/editor/slide-design";

export function SlideColorOverlay({ color, opacity }: SlideBackground) {
  return <span aria-hidden="true" data-slide-color-overlay className="pointer-events-none absolute inset-0" style={{ ...backgroundPaint(color), opacity: opacity / 100 }} />;
}
