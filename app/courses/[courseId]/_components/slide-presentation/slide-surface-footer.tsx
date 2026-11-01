import type { ReactNode } from "react";
import { defaultSlideMaster, resolveSlideSize, type SlideMaster } from "@/lib/editor/slide-design";
import { resolveNavigationButtons } from "@/lib/editor/slide-navigation-design";
import { SlideNavigationDesignProvider } from "./slide-navigation-controls";
import { SlideFooter } from "./slide-footer";

export function SlideSurfaceFooter({ hidden, showNavigation = !hidden, master = defaultSlideMaster, number, total, controls, decorative }: {
  hidden?: boolean; showNavigation?: boolean; master?: SlideMaster; number: number; total: number; controls?: ReactNode; decorative?: boolean;
}) {
  if (!hidden) return <SlideFooter master={master} number={number} total={total} controls={showNavigation ? controls : undefined} decorative={decorative} />;
  if (decorative || !showNavigation || !controls) return null;
  const size = resolveSlideSize(master);
  return <div data-slide-floating-navigation className="absolute bottom-3 right-3 z-30 rounded-lg bg-white/90 p-1 shadow-sm">
    <SlideNavigationDesignProvider settings={resolveNavigationButtons(master.navigationButtons, master.accentColor)} availableWidth={Math.min(size.width - 32, 320)} availableHeight={48} canvasWidth={size.width} rightInset={12} tipMaxHeight={Math.max(120, size.height - 80)}>{controls}</SlideNavigationDesignProvider>
  </div>;
}
