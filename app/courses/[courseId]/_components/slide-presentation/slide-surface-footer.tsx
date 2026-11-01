import type { ReactNode } from "react";
import { defaultSlideMaster, resolveSlideFooter, resolveSlideSize, type SlideMaster } from "@/lib/editor/slide-design";
import { resolveNavigationButtons } from "@/lib/editor/slide-navigation-design";
import { SlideNavigationDesignProvider } from "./slide-navigation-controls";
import { SlideFooter } from "./slide-footer";

/** Hidden branding still leaves the existing locked navigation usable on image slides. */
export function SlideSurfaceFooter({ hidden, master = defaultSlideMaster, number, total, controls, decorative }: {
  hidden?: boolean; master?: SlideMaster; number: number; total: number; controls?: ReactNode; decorative?: boolean;
}) {
  if (!hidden) return <SlideFooter master={master} number={number} total={total} controls={controls} decorative={decorative} />;
  if (decorative || !controls) return null;
  const size = resolveSlideSize(master), footer = resolveSlideFooter(master);
  return <div data-slide-floating-navigation className="absolute bottom-3 right-3 z-30 rounded-lg bg-white/90 p-1 shadow-sm">
    <SlideNavigationDesignProvider settings={resolveNavigationButtons(master.navigationButtons, footer.textColor)} availableWidth={Math.min(size.width - 32, 320)} availableHeight={48} canvasWidth={size.width} rightInset={12} tipMaxHeight={Math.max(120, size.height - 80)}>{controls}</SlideNavigationDesignProvider>
  </div>;
}
